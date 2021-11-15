const roundDurationSec = 5
const numberOfRounds = 5
const warnInSec = 0
const volume = 0.01

let shouldStopSession
let isSessionRunning
let roundElapsedTimeSec
let isCurrentRoundRecorded
let currentRoundNumber

const getBeep = (duration) => {
    const audioStr = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'
                   + Array(duration).join('123')  
    const audio = new Audio(audioStr)            
    audio.volume = volume
    return audio
}

const beepShort = getBeep(1000)
const beepLong = getBeep(4000)

const startSession = async () => {
    if (isSessionRunning) return

    shouldStopSession = false
    isSessionRunning = true
    beepShort.play()
    console.log('SESSION STARTED')

    for (i = 1; i <= numberOfRounds; i++) {
        currentRoundNumber = i
        console.log('ROUND ' + (i))
        if (await startRound()) break
    }

    isSessionRunning = false
    beepLong.play()
    console.log('SESSION COMPLETED')
}

const startRound = () => new Promise((resolve, reject) => {
    isCurrentRoundRecorded = false
    roundElapsedTimeSec = 0
    const interval = 1000
    const start = Date.now()
    const end = start + roundDurationSec * 1000
    let expected = start + interval
    
    const step = () => {
        if (shouldStopSession) {
            resolve(true)
        } else {
            roundElapsedTimeSec = Math.floor((Date.now() - start) / 1000)
            printElapsedTime(roundElapsedTimeSec)
            beepCountdown(roundElapsedTimeSec)

            if (Date.now() >= end) {
                recordHoldTime(roundElapsedTimeSec)
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

const stopSession = () => {
    shouldStopSession = true
}

const printElapsedTime = (elapsedSec) => {
    let min = Math.floor(elapsedSec / 60)
    let sec = elapsedSec - min * 60
    console.log(formatValue(min) + ':' + formatValue(sec))
}

const formatValue = (value) => {
    return value < 10 ? '0' + value : value
}

const beepCountdown = (elapsedSec) => {
    if (roundDurationSec === elapsedSec) {
        beepLong.play() 
    } else if (0 < roundDurationSec - elapsedSec < warnInSec) {
        beepShort.play()
    }
}

const recordHoldTime = () => {
    if (!isCurrentRoundRecorded) {
        console.log('round: ', currentRoundNumber, 'hold: ', roundElapsedTimeSec)
    }
    isCurrentRoundRecorded = true
}

const handlePressSpaceBtn = (e) => {
    if (e.keyCode === 32) {
        if (isSessionRunning) {
            recordHoldTime()
        } else {
            startSession()
        }
    }
}

const configureEventListeners = () => {
    window.addEventListener('keyup', handlePressSpaceBtn)
}
