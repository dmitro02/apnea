class Timer {
    constructor(duration, onInterval, interval = 1000) {
        this.duration = duration
        this.interval = interval
        this.onInterval = onInterval
        this.elapsed = 0
    }
    isInterrupted = false
    stop() { this.isInterrupted = true }
    start() {
        return new Promise((resolve) => {
            const start = Date.now()
            const end = start + this.duration * 1000
            let expected = start + this.interval
            
            const step = () => {
                if (this.isInterrupted) {
                    resolve(true)
                } else {
                    this.elapsed = Math.floor((Date.now() - start) / 1000)
                    this.onInterval && this.onInterval(this.elapsed)
        
                    if (Date.now() >= end) {
                        resolve(false)
                    } else {
                        const drift = Date.now() - expected
                        if (drift > this.interval) {
                            console.error('timer error')
                        }
                        expected += this.interval
                        setTimeout(step, Math.max(0, this.interval - drift))
                    }
                }
            }
            setTimeout(step, this.interval)
        })
    }
}

class App {
    isRunning = false
    records
    currentRound
    currentRoundNumber
    isCurrentRoundRecorded
    config = new Config()

    constructor() {
        this.ui = new UI(this)
        this.sound = new Sound(this.config.volume)
    }

    init = () => {
        this.ui.init()
        this.registerServiceWorker()
    }

    async start() {
        if (this.isRunning) return
        
        this.isRunning = true

        this.records = []

        for (let i = 1; i <= this.config.numberOfRounds; i++) {  
            this.currentRoundNumber = i
            this.isCurrentRoundRecorded = false
            this.currentRound = new Timer(
                this.config.roundDuration, this.onInterval)

            this.ui.onRoundStarted(i)

            const isInterrupted = await this.currentRound.start()
            this.record()
            this.sound.beepLong.play()
            if (isInterrupted) break
        }

        this.isRunning = false

        this.ui.onSessionEnded(
            this.maxHoldingTime, 
            this.avrgHoldingTime
        ) 
    }

    stop() { this.currentRound.stop() }

    record() {
        if (this.isCurrentRoundRecorded) return
        this.ui.onRoundRecorded(
            this.currentRoundNumber, 
            this.currentRound.elapsed
        )
        this.isCurrentRoundRecorded = true
        this.records.push(this.currentRound.elapsed)
    }

    onInterval = (elapsed) => {
        this.ui.renderTimeIndicator(elapsed)

        const { roundDuration, countdownDuration } = this.config
        if (countdownDuration && countdownDuration < roundDuration) {
            const timeLeft = roundDuration - elapsed
            if (timeLeft > 0 && timeLeft <= countdownDuration) {
                this.sound.beepShort.play()
                this.ui.getTimeIndicator().classList.add('shadow-pulse')
            } else {    
                this.ui.getTimeIndicator().classList.remove('shadow-pulse')
            }
        }
    }

    get avrgHoldingTime() { 
        const total = this.records.reduce((p, c) => p + c, 0)
        return Math.round(total / this.records.length)
    }

    get maxHoldingTime() { 
        return Math.max(...this.records)
    }

    registerServiceWorker = () => {
        if ("serviceWorker" in navigator) {
            window.addEventListener("load", () =>
                navigator.serviceWorker.register("./serviceWorker.js")
            )
        }
    }
}

class UI {
    constructor(app) {
        this.app = app
        this.config = app.config
    }

    displayMainPanel = () => {
        this.getMainPanel().style.display = 'block'
        this.getSettingsPanel().style.display = 'none'
        this.getHelpPanel().style.display = 'none'
    }

    displaySettingsPanel = () => {
        this.getMainPanel().style.display = 'none'
        this.getSettingsPanel().style.display = 'block'
        this.getHelpPanel().style.display = 'none'
    }

    displayHelpPanel = () => {
        this.getMainPanel().style.display = 'none'
        this.getSettingsPanel().style.display = 'none'
        this.getHelpPanel().style.display = 'block'
    }

    renderTimeIndicator = (elapsedSec = 0) => {
        const timeLeftSec = this.config.roundDuration === elapsedSec 
            ? this.config.roundDuration
            : this.config.roundDuration - elapsedSec
        this.getTimeIndicator().textContent = this.formatTime(timeLeftSec)
    }
    
    renderRoundIndicator = (currentRoundNumber = '-') => {
        this.getRoundIndicator().textContent = 
            currentRoundNumber + '/' + this.config.numberOfRounds
    }
    
    renderSessionResults = (roundNumber, recordSec) => {
        if (!roundNumber && !recordSec) {
            this.getSessionResultsLeft().innerHTML = '' 
            this.getSessionResultsRight().innerHTML = ''
            return
        }
        this.renderRoundRecord(roundNumber, recordSec)
    }
    
    renderStartBtn = () => {
        const btn = this.getStartBtn()
        this.removeClickListener(btn, this.handleClickOnRecordBtn)
        this.addClickListener(btn, this.handleClickOnStartBtn)
        btn.textContent = 'start'
        btn.disabled = false
    }
    
    renderRecordBtn = (isDisabled) => {
        const btn = this.getStartBtn()
        this.removeClickListener(btn, this.handleClickOnStartBtn)
        this.addClickListener(btn, this.handleClickOnRecordBtn)
        btn.textContent = 'record'
        btn.disabled = isDisabled
    }
    
    renderStopBtn = (isDisabled) => {
        const btn = this.getStopBtn()
        this.removeClickListener(btn, this.reset)
        this.addClickListener(btn, this.handleClickOnStopBtn)
        btn.textContent = 'stop'
        btn.disabled = isDisabled
    }
    
    renderResetBtn = () => {
        const btn = this.getStopBtn()
        this.removeClickListener(btn, this.handleClickOnStopBtn)
        this.addClickListener(btn, this.reset)
        btn.textContent = 'reset'
    }
    
    renderRoundRecord = (roundNumber, recordSec) => {
        const clone = this.getRoundRecordTemplate().content.cloneNode(true)
        this.getRoundNumber(clone).textContent = roundNumber + '.'
        this.getRoundResult(clone).textContent = this.formatTime(recordSec)
        roundNumber <= Math.ceil(this.config.numberOfRounds / 2)
            ? this.getSessionResultsLeft().appendChild(clone)
            : this.getSessionResultsRight().appendChild(clone)
    }

    renderSessionResult = (max, avrg) => {
        if (!max || !avrg) {
            this.getSessionResult().style.display = "none"
        } else {
            this.getSessionResult().style.display = "block"
            this.getSessionResultMax().innerText = this.formatTime(max)
            this.getSessionResultAvrg().innerText =  this.formatTime(avrg)
        }
    }

    renderSettingsPanel = () => {
        const rdm = this.getRoundDurationMinInpt()
        const rds = this.getRoundDurationSecInpt()
        const nr = this.getNumberOfRoundsInpt()
        const cd = this.getCountdownDurationInpt()

        rdm.value = this.config.getRoundDurationMin()
        rds.value = this.config.getRoundDurationSec()
        nr.value = this.config.numberOfRounds
        cd.value = this.config.countdownDuration
        this.getVolumeInpt().value = this.config.getVolumeInteger()

        rdm.addEventListener('change', this.validateRoundDurationMin)
        rds.addEventListener('change', this.validateRoundDurationSec)
        nr.addEventListener('change', this.validateNumberOfRounds)
        cd.addEventListener('change', this.validateCountdownDuration)

        this.displaySettingsPanel()
    }

    handleSaveSettings = () => {
        const rdm = this.getRoundDurationMinInpt().value
        const rds = this.getRoundDurationSecInpt().value
        const nr = this.getNumberOfRoundsInpt().value
        const cd = this.getCountdownDurationInpt().value
        const v = this.getVolumeInpt().value / 100

        this.config.setRoundDuration(rdm, rds)
        this.config.setNumberOfRounds(nr)
        this.config.setCountdownDuration(cd)
        this.config.setVolume(v)

        this.app.sound.setVolume(v)

        this.displayMainPanel()

        this.reset()
    }
    
    onRoundStarted = (numberOfRounds, roundNumber) => {
        this.renderRoundIndicator(numberOfRounds, roundNumber)
        this.renderTimeIndicator()
        this.renderRecordBtn()
    }

    onRoundRecorded = (roundNumber, elapsed) => {
        this.renderSessionResults(roundNumber, elapsed)
    }

    onSessionEnded = (max, avrg) => {
        this.renderStartBtn()
        this.renderResetBtn()
        this.renderSessionResult(max, avrg)
        this.getOpenSettingsBtn().style.visibility = "visible"
    }

    handlePressKey = (e) => {
        if (e.keyCode === 27) {  // Escape
            if (this.isSettingsView) {
                this.getCloseSettingsBtn().click()
            } else if (this.isHelpView) {
                this.getCloseHelpBtn().click()
            }
        }
        if (e.keyCode === 32) {  // Space
            if (!this.isSettingsView && !this.isHelpView) {
                this.getStopBtn().blur()
                this.getStartBtn().click()                
            }
        }
    }

    handleClickOnStartBtn = () => { 
        this.beepShort()
        this.renderSessionResults()
        this.renderSessionResult()
        this.renderRecordBtn()
        this.renderStopBtn()
        this.getOpenSettingsBtn().style.visibility = 'hidden'
        this.app.start()
    }

    handleClickOnStopBtn = () => {
        this.beepShort()
        this.app.stop()
    }

    handleClickOnRecordBtn = () => {
        this.beepShort()
        this.renderRecordBtn(true)
        this.app.record() 
    }

    validateRoundDurationMin = (e) =>
    this.validateTimeValue(e, this.config.getRoundDurationMin())

    validateRoundDurationSec = (e) =>
        this.validateTimeValue(e, this.config.getRoundDurationSec())

    validateCountdownDuration = (e) =>
        this.validateTimeValue(e, this.config.countdownDuration)

    validateNumberOfRounds = (e) => {
        const value = e.target.value
        if (value === '' || value < 1) {
            e.target.value = this.config.numberOfRounds
        }
    }

    validateTimeValue = (e, fallbackValue) => {
        const value = e.target.value
        if (value === '' || value < 0 || value > 59) {
            e.target.value = fallbackValue
        }
    }

    reset = () => {
        this.renderRoundIndicator()
        this.renderTimeIndicator()
        this.renderSessionResults()
        this.renderSessionResult()
        this.renderStartBtn()
        this.renderStopBtn(true)
    }
    
    init = () => {
        this.reset()

        this.addClickListener(this.getOpenSettingsBtn(), this.renderSettingsPanel)
        this.addClickListener(this.getCloseSettingsBtn(), this.handleSaveSettings)
        this.addClickListener(this.getOpenHelpBtn(), this.displayHelpPanel)
        this.addClickListener(this.getCloseHelpBtn(), this.displayMainPanel)

        window.addEventListener('keyup', this.handlePressKey)
    }

    addClickListener = (el, handler) => el.addEventListener('click', handler)

    removeClickListener = (el, handler) => el.removeEventListener('click', handler)

    getElement = (selector, parent) => {
        return (parent || document).querySelector(selector)
    }

    formatTime = (elapsedSec) => {
        let min = Math.floor(elapsedSec / 60)
        let sec = elapsedSec - min * 60
        return this.formatTimeValue(min) + ':' + this.formatTimeValue(sec)
    }
    
    formatTimeValue = (val) => val < 10 ? '0' + val : val

    beepShort = () => this.app.sound.beepShort.play()

    get isHelpView() { return this.getHelpPanel().style.display === 'block' }
    get isSettingsView() { return this.getSettingsPanel().style.display === 'block' }

    getMainPanel = () => this.getElement('.main-box')
    getStartBtn = () => this.getElement('.start-record-btn')
    getStopBtn = () => this.getElement('.stop-reset-btn')
    getTimeIndicator = () => this.getElement('.time-indicator')
    getRoundIndicator = () => this.getElement('.round-indicator')
    getSessionResultsLeft = () => this.getElement('.session-records-left')
    getSessionResultsRight = () => this.getElement('.session-records-right')
    getSessionResult = () => this.getElement('.session-result')
    getSessionResultMax = () => this.getElement('.session-result-max-value')
    getSessionResultAvrg = () => this.getElement('.session-result-avrg-value')
    getRoundRecordTemplate = () => this.getElement('#round-record')
    getRoundNumber = (el) => this.getElement('.round-number', el)
    getRoundResult = (el) => this.getElement('.round-result', el)
    getRoundDurationMinInpt = () => this.getElement('#roundDurationMin')
    getRoundDurationSecInpt = () => this.getElement('#roundDurationSec')
    getCountdownDurationInpt = () => this.getElement('#contdownDuration')
    getNumberOfRoundsInpt = () => this.getElement('#numberOfRounds')
    getVolumeInpt = () => this.getElement('#volume')
    getOpenSettingsBtn = () => this.getElement('.open-settings-btn')
    getCloseSettingsBtn = () => this.getElement('.close-settings-btn')
    getSettingsPanel = () => this.getElement('.settings-box')
    getOpenHelpBtn = () => this.getElement('.open-help-btn')
    getCloseHelpBtn = () => this.getElement('.close-help-btn')
    getHelpPanel = () => this.getElement('.help-box')
} 

class Sound {
    sounds = []

    constructor(volume) {
        this.defaultVolume = volume

        this.beepShort = this.getBeep(1000)
        this.beepLong = this.getBeep(4000)
    }

    getBeep = (duration) => {
        const audioStr = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'
                       + Array(duration).join('123')  
        const audio = new Audio(audioStr) 
        audio.volume = this.defaultVolume
        this.sounds.push(audio)
        return audio
    }

    setVolume(volume) {
        this.sounds.forEach((s) => s.volume = volume)
    }
}

class Config {
    DEFAULT_ROUND_DURATION = 240
    DEFAULT_NUMBER_OF_ROUNDS = 8
    DEFAULT_COUNTDOWN_DURATION = 20
    DEFAULT_VOLUME = 0.01
    ROUND_DURATION_ITEM_NAME = 'apneaAppRoundDuration'
    NUMBER_OF_ROUNDS_ITEM_NAME = 'apneaAppNumberOfRounds'
    COUNTDOWN_DURATION_ITEM_NAME = 'apneaAppCountdownDuration'
    VOLUME_ITEM_NAME = 'apneaAppVolume'
    constructor() {
        this.roundDuration = this.restoreFromLocalStorage(
            this.ROUND_DURATION_ITEM_NAME, 
            this.DEFAULT_ROUND_DURATION
        ) 
        this.numberOfRounds = this.restoreFromLocalStorage(
            this.NUMBER_OF_ROUNDS_ITEM_NAME, 
            this.DEFAULT_NUMBER_OF_ROUNDS
        ) 
        this.countdownDuration = this.restoreFromLocalStorage(
            this.COUNTDOWN_DURATION_ITEM_NAME, 
            this.DEFAULT_COUNTDOWN_DURATION
        ) 
        this.volume = this.restoreFromLocalStorage(
            this.VOLUME_ITEM_NAME, 
            this.DEFAULT_VOLUME
        ) 
    }

    setRoundDuration(val1, val2) {
        if (val1 && val2) {
            this.roundDuration = val1 * 60 + val2 * 1
        } else {
            this.roundDuration = val1
        }
        localStorage.setItem(this.ROUND_DURATION_ITEM_NAME, this.roundDuration)
    }

    setNumberOfRounds(value) {
        this.numberOfRounds = value
        localStorage.setItem(this.NUMBER_OF_ROUNDS_ITEM_NAME, value)
    }

    setCountdownDuration(value) {
        this.countdownDuration = value
        localStorage.setItem(this.COUNTDOWN_DURATION_ITEM_NAME, value)
    }

    setVolume(value) {
        this.volume = value
        localStorage.setItem(this.VOLUME_ITEM_NAME, value)
    }

    restoreFromLocalStorage = (itemName, defaultValue) =>
        parseFloat(localStorage.getItem(itemName)) || defaultValue

    getRoundDurationMin = () => Math.floor(this.roundDuration / 60)

    getRoundDurationSec = () => this.roundDuration % 60

    getVolumeInteger = () => this.volume * 100
}

new App().init()
