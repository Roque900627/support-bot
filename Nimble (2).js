ModAPI.registerMod({
    id: 'achievement_mod_fixed',
    name: '🏆 Achievement System (Fixed)',
    version: '1.2.0',
    author: 'You',
    description: 'Fixed achievement system — tracks only user matches, proper error isolation.',
    
    achievements: [
        { id: 'first_match', name: 'Дебют', desc: 'Сыграть первый матч', icon: '⚽', progress: 0, target: 1, unlocked: false },
        { id: 'first_win', name: 'Первая Победа', desc: 'Выиграть первый матч', icon: '✅', progress: 0, target: 1, unlocked: false },
        { id: 'first_transfer', name: 'Первый Трансфер', desc: 'Купить первого игрока', icon: '🤝', progress: 0, target: 1, unlocked: false },
        { id: 'champion', name: 'Чемпион!', desc: 'Выиграть чемпионат', icon: '🥇', progress: 0, target: 1, unlocked: false },
        { id: 'clean_sheet', name: 'Сухарь', desc: 'Сыграть 5 матчей без пропущенных голов', icon: '🛡️', progress: 0, target: 5, unlocked: false },
        { id: 'win_streak', name: 'Серия!', desc: 'Выиграть 5 матчей подряд', icon: '🔥', progress: 0, target: 5, unlocked: false },
        { id: 'big_transfer', name: 'Большие деньги', desc: 'Купить игрока за 50 млн+', icon: '💰', progress: 0, target: 50000000, unlocked: false },
        { id: 'legend', name: 'Легенда', desc: 'Тренировать игрока до 90+ рейтинга', icon: '⭐', progress: 0, target: 90, unlocked: false }
    ],
    
    stats: {
        matchesPlayed: 0,
        matchesWon: 0,
        cleanSheets: 0,
        winStreak: 0,
        maxWinStreak: 0,
        seasonsWon: 0,
        consecutiveChamps: 0,
        bigTransfers: 0,
        legendsTrained: 0
    },
    
    init: function(api) {
        this.api = api;
        this.loadProgress();
        api.showNotification('🏆 Achievement System v1.2 Loaded!', 2000);
    },
    
    onEnable: function(api) {
        this.setupEventListeners();
    },
    
    onDisable: function(api) {
        this.saveProgress();
    },
    
    // ========== HELPERS ==========
    
    _getUserTeamId: function() {
        try {
            // Try multiple ways to get user team ID
            const id = this.api.getUserTeamId();
            if (id != null) return id;
            const team = this.api.getUserTeam();
            if (team) return team.id;
            // Fallback: check STATE directly
            if (window.STATE && window.STATE.userTeamId != null) return window.STATE.userTeamId;
        } catch (e) {
            console.warn('[Achievements] Could not get user team ID:', e);
        }
        return null;
    },
    
    _isUserMatch: function(match) {
        const uid = this._getUserTeamId();
        if (uid == null) return false;
        const homeId = match.homeTeamId ?? match.homeId;
        const awayId = match.awayTeamId ?? match.awayId;
        // Use loose equality to handle string/number mismatch
        return homeId == uid || awayId == uid;
    },
    
    _getUserMatchResult: function(match) {
        const uid = this._getUserTeamId();
        if (uid == null) return null;
        
        const homeId = match.homeTeamId ?? match.homeId;
        const awayId = match.awayTeamId ?? match.awayId;
        const homeScore = match.homeScore ?? match.homeGoals ?? 0;
        const awayScore = match.awayScore ?? match.awayGoals ?? 0;
        
        let userScore, oppScore;
        if (homeId == uid) {
            userScore = homeScore;
            oppScore = awayScore;
        } else if (awayId == uid) {
            userScore = awayScore;
            oppScore = homeScore;
        } else {
            return null; // Not user's match
        }
        
        let result;
        if (userScore > oppScore) result = 'win';
        else if (userScore < oppScore) result = 'loss';
        else result = 'draw';
        
        return { result, userScore, oppScore, homeScore, awayScore };
    },
    
    // ========== EVENT LISTENERS ==========
    
    setupEventListeners: function() {
        const api = this.api;
        
        // Listen to both matchEnd and onMatchEnd for maximum compatibility
        api.on('matchEnd', (match) => this.handleMatchEnd(match));
        
        api.on('transfer', (transfer) => this.handleTransfer(transfer));
        
        api.on('playerTrain', (player) => this.handlePlayerTrain(player));
        
        api.on('seasonEnd', (season) => this.handleSeasonEnd(season));
        
        // Add menu item
        api.addMenuItem({
            id: 'achievements_menu',
            label: '🏆 Achievements',
            icon: '🏆',
            onClick: () => this.showAchievementsScreen()
        });
        
        console.log('[Achievements] Event listeners registered');
    },
    
    // ========== EVENT HANDLERS ==========
    
    handleMatchEnd: function(match) {
        try {
            // CRITICAL: Only process user's own matches!
            if (!this._isUserMatch(match)) {
                return; // Skip non-user matches entirely
            }
            
            const res = this._getUserMatchResult(match);
            if (!res) return;
            
            console.log('[Achievements] User match ended:', res.result, 
                         res.userScore + '-' + res.oppScore);
            
            // ---- First match ----
            this.stats.matchesPlayed++;
            this.updateAchievement('first_match', 1);
            
            // ---- Win / loss tracking ----
            if (res.result === 'win') {
                this.stats.matchesWon++;
                this.stats.winStreak++;
                
                if (this.stats.winStreak > this.stats.maxWinStreak) {
                    this.stats.maxWinStreak = this.stats.winStreak;
                }
                
                this.updateAchievement('first_win', 1);
                this.updateAchievement('win_streak', this.stats.winStreak);
                
                console.log('[Achievements] Win! Streak:', this.stats.winStreak);
            } else {
                this.stats.winStreak = 0;
            }
            
            // ---- Clean sheet ----
            if (res.oppScore === 0 && res.userScore > 0) {
                this.stats.cleanSheets++;
                this.updateAchievement('clean_sheet', this.stats.cleanSheets);
                console.log('[Achievements] Clean sheet! Total:', this.stats.cleanSheets);
            }
            
            this.saveProgress();
            
        } catch (e) {
            console.error('[Achievements] Error in handleMatchEnd:', e);
        }
    },
    
    handleTransfer: function(transfer) {
        try {
            const uid = this._getUserTeamId();
            if (uid == null) return;
            
            const toTeamId = transfer.toTeamId ?? transfer.toTeam?.id;
            
            // Only track transfers TO user's team (buying players)
            if (toTeamId != uid) return;
            
            console.log('[Achievements] User transfer detected, fee:', transfer.fee);
            
            this.updateAchievement('first_transfer', 1);
            
            if (transfer.fee >= 50000000) {
                this.stats.bigTransfers++;
                this.updateAchievement('big_transfer', transfer.fee);
                console.log('[Achievements] Big transfer!', transfer.fee);
            }
            
            this.saveProgress();
        } catch (e) {
            console.error('[Achievements] Error in handleTransfer:', e);
        }
    },
    
    handlePlayerTrain: function(player) {
        try {
            if (player && player.rating >= 90) {
                this.stats.legendsTrained++;
                this.updateAchievement('legend', player.rating);
                console.log('[Achievements] Legend trained! Rating:', player.rating);
            }
            this.saveProgress();
        } catch (e) {
            console.error('[Achievements] Error in handlePlayerTrain:', e);
        }
    },
    
    handleSeasonEnd: function(season) {
        try {
            const userTeam = this.api.getUserTeam();
            if (!userTeam) {
                console.warn('[Achievements] No user team found at season end');
                return;
            }
            
            // Check if user won the league
            if (userTeam.leagueId) {
                try {
                    const table = this.api.getLeagueTable(userTeam.leagueId);
                    if (table && table.length > 0 && table[0].id == userTeam.id) {
                        this.stats.seasonsWon++;
                        this.stats.consecutiveChamps++;
                        this.updateAchievement('champion', 1);
                        console.log('[Achievements] Champion! Seasons won:', this.stats.seasonsWon);
                    } else {
                        this.stats.consecutiveChamps = 0;
                    }
                } catch (e) {
                    console.error('[Achievements] Error getting league table:', e);
                }
            }
            
            this.saveProgress();
        } catch (e) {
            console.error('[Achievements] Error in handleSeasonEnd:', e);
        }
    },
    
    // ========== ACHIEVEMENT SYSTEM ==========
    
    updateAchievement: function(id, value) {
        try {
            const ach = this.achievements.find(a => a.id === id);
            if (!ach || ach.unlocked) return;
            
            if (typeof value === 'number') {
                ach.progress = Math.max(ach.progress, value);
            } else {
                ach.progress++;
            }
            
            if (ach.progress >= ach.target) {
                this.unlockAchievement(ach);
            }
        } catch (e) {
            console.error('[Achievements] Error updating achievement:', id, e);
        }
    },
    
    unlockAchievement: function(achievement) {
        try {
            achievement.unlocked = true;
            achievement.unlockedAt = new Date().toISOString();
            
            console.log('[Achievements] 🏆 UNLOCKED:', achievement.name);
            
            this.api.showNotification(
                '🏆 ' + achievement.name + '!',
                3000,
                'success'
            );
            
            try {
                this.api.addNews(
                    '🏆 ' + achievement.name,
                    achievement.desc,
                    'info'
                );
            } catch (e) {
                // addNews is non-critical, don't let it break achievements
                console.warn('[Achievements] addNews failed:', e);
            }
        } catch (e) {
            console.error('[Achievements] Error unlocking achievement:', achievement?.id, e);
        }
    },
    
    // ========== UI ==========
    
    showAchievementsScreen: function() {
        var self = this;
        var unlockedCount = this.achievements.filter(function(a) { return a.unlocked; }).length;
        var totalCount = this.achievements.length;
        var pct = Math.round(unlockedCount / totalCount * 100);
        
        var html = '<div style="padding: 20px; background: #1e1e2d; color: white; height: 100%; overflow-y: auto;">'
            + '<h1 style="text-align: center; color: gold;">🏆 Achievements</h1>'
            + '<p style="text-align: center; font-size: 18px;">' + unlockedCount + '/' + totalCount + ' Unlocked (' + pct + '%)</p>'
            + '<div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 15px; margin-top: 20px;">';
        
        this.achievements.forEach(function(ach) {
            var isUnlocked = ach.unlocked;
            var bg = isUnlocked ? 'linear-gradient(45deg, #4CAF50, #2E7D32)' : '#444';
            var statusText = isUnlocked ? '<span style="color: gold;">UNLOCKED</span>' : (ach.progress + '/' + ach.target);
            
            html += '<div style="'
                + 'width: 200px; padding: 15px; border-radius: 10px; '
                + 'background: ' + bg + '; color: white; text-align: center; '
                + 'box-shadow: 0 4px 8px rgba(0,0,0,0.3);">'
                + '<div style="font-size: 40px; margin-bottom: 10px;">' + ach.icon + '</div>'
                + '<h3>' + ach.name + '</h3>'
                + '<p style="font-size: 12px; opacity: 0.9; margin: 8px 0;">' + ach.desc + '</p>'
                + '<div style="margin-top: 10px; font-size: 14px;">' + statusText + '</div>'
                + '</div>';
        });
        
        html += '</div>'
            + '<div style="text-align: center; margin-top: 20px; padding: 15px; background: #2a2a3d; border-radius: 10px;">'
            + '<h3 style="color: #aaa;">📊 Stats</h3>'
            + '<p>Matches: ' + self.stats.matchesPlayed + ' | Wins: ' + self.stats.matchesWon + '</p>'
            + '<p>Clean Sheets: ' + self.stats.cleanSheets + ' | Best Win Streak: ' + self.stats.maxWinStreak + '</p>'
            + '<p>Seasons Won: ' + self.stats.seasonsWon + ' | Big Transfers: ' + self.stats.bigTransfers + '</p>'
            + '</div>'
            + '</div>';
        
        this.api.registerScreen('achievements_screen_fixed', {
            title: '🏆 My Achievements',
            render: function() { return html; }
        });
        
        this.api.openScreen('achievements_screen_fixed');
    },
    
    // ========== PERSISTENCE ==========
    
    saveProgress: function() {
        try {
            var data = {
                achievements: this.achievements,
                stats: this.stats
            };
            this.api.saveModData('achievement_mod_fixed', data);
        } catch (e) {
            console.error('[Achievements] Error saving:', e);
        }
    },
    
    loadProgress: function() {
        var self = this;
        try {
            this.api.loadModData('achievement_mod_fixed').then(function(data) {
                if (data) {
                    if (Array.isArray(data.achievements)) {
                        self.achievements = data.achievements;
                    }
                    if (data.stats) {
                        // Merge saved stats with defaults to handle new fields
                        Object.keys(self.stats).forEach(function(key) {
                            if (data.stats[key] !== undefined) {
                                self.stats[key] = data.stats[key];
                            }
                        });
                    }
                    
                    // Ensure all achievements have required fields
                    self.achievements.forEach(function(ach) {
                        ach.progress = ach.progress || 0;
                        ach.unlocked = ach.unlocked || false;
                        ach.unlockedAt = ach.unlockedAt || null;
                    });
                    
                    console.log('[Achievements] Progress loaded, unlocked:', 
                        self.achievements.filter(function(a) { return a.unlocked; }).length);
                }
            }).catch(function(e) {
                console.log('[Achievements] No saved data, starting fresh.');
            });
        } catch (e) {
            console.error('[Achievements] Critical error loading:', e);
        }
    }
});
