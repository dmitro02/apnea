const ROUND_DURATION = 7
const NUMBER_OF_ROUNDS = 5
const COUNTDOWN_DURATION = 3
const VOLUME = 0.01

const getBeep = (duration) => {
    const audioStr = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'
                   + Array(duration).join('123')  
    const audio = new Audio(audioStr)            
    audio.volume = VOLUME
    return audio
}

const BEEP_SHORT = getBeep(1000)
const BEEP_LONG = getBeep(4000)

let session

const startSession = () => {
    if (!session || !session.isRunning) {
        session = new Session(
            NUMBER_OF_ROUNDS, 
            ROUND_DURATION, 
            COUNTDOWN_DURATION
        )
        session.run()
    }
}

const stopSession = () => {
    session.willBeStopped = true
}

const printElapsedTime = (elapsedSec) => {
    let min = Math.floor(elapsedSec / 60)
    let sec = elapsedSec - min * 60
    console.log(formatValue(min) + ':' + formatValue(sec))
}

const formatValue = (value) => {
    return value < 10 ? '0' + value : value
}

const recordHoldTime = () => {
    session.currentRound.record()
}

const handlePressSpaceBtn = (e) => {
    if (e.keyCode === 32) {
        if (session && session.isRunning) {
            recordHoldTime()
        } else {
            startSession()
        }
    }
}

const configureEventListeners = () => {
    window.addEventListener('keyup', handlePressSpaceBtn)
}

class Session {
    numberOfRounds
    roundDuration
    countdownDuration
    willBeStopped = false
    isRunning = false
    currentRound 
    rounds = []
    constructor(numberOfRounds, roundDuration, countdownDuration) {
        this.numberOfRounds = numberOfRounds
        this.roundDuration = roundDuration
        this.countdownDuration = countdownDuration
    }
    async run() {
        this.isRunning = true
        BEEP_SHORT.play()
        console.log('SESSION STARTED')
    
        for (let i = 1; i <= this.numberOfRounds; i++) {
            this.currentRound = new Round(
                i, this.roundDuration, this.countdownDuration)
            this.rounds.push(this.currentRound)
            if (await this.currentRound.run()) break
        }
    
        this.isRunning = false
        BEEP_LONG.play()
        console.log('SESSION COMPLETED')
        console.log(JSON.stringify(this.rounds, null, 4));
    }
    get duration() { return 0 }
    get totalHoldingTime() { return 0 }
    get maxHoldingTime() { return 0 }
    get holdingPercentage() { return 0 }
}

class Round {
    number
    duration
    countdownDuration
    elapsedSec = 0
    recordSec
    constructor(number, duration, countdownDuration) {
        this.number = number
        this.duration = duration
        this.countdownDuration = countdownDuration
    }
    run() {
        return new Promise((resolve, reject) => {
            console.log('ROUND ' + (this.number))
            const interval = 1000
            const start = Date.now()
            const end = start + this.duration * 1000
            let expected = start + interval
            
            const step = () => {
                if (session.willBeStopped) {
                    this.record()
                    resolve(true)
                } else {
                    this.elapsedSec = Math.floor((Date.now() - start) / 1000)
                    printElapsedTime(this.elapsedSec)
                    this.beepCountdown()
        
                    if (Date.now() >= end) {
                        this.record()
                        resolve(false)
                    } else {
                        const drift = Date.now() - expected;
                        if (drift > interval) {
                            console.error('Timer is not working poperly!')
                        }
                        expected += interval
                        setTimeout(step, Math.max(0, interval - drift))
                    }
                }
            }
            setTimeout(step, interval)
        })
    }
    record() {
        if (this.recordSec == null) {
            this.recordSec = this.elapsedSec
            BEEP_LONG.play()
            console.log('round: ', this.number, 'hold: ', this.recordSec)
        }
    }
    beepCountdown() {
        const timeLeft = this.duration - this.elapsedSec
        if (timeLeft === 0) {
            BEEP_LONG.play() 
        } else if (timeLeft > 0 && timeLeft < this.countdownDuration) {
            BEEP_SHORT.play()
        }
    }
}
