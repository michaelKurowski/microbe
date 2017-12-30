//Graphics settings
const renderingInterval = 1000 / 60 //60fps
const debugMode = false
const destinationPointerSize = 20
const destinationPointerAnimationSpeed = 0.012

//Environment objects
const bubblesAmount = 160
const bubbleMinSize = 4
const bubbleMaxSize = 10

const diatomsAmount = 4
const diatomMinSize = 40
const diatomMaxSize = 80

//Cell
const cellParticlesAmount = 160
const cellParticlesSpreadnessRadius = 1.1
const cytoplasmaParticlesColor = 'rgba(20, 60, 60, 0.3)'
const cellParticleMaxSize = 3
const cellParticleMinSize = 1
const cellParticleColorFormula = () => `rgba(${Math.round(randomNumber(0, 100))}, 100, 100, 0.3)`


const cellBarrierOuterColor = 'rgba(10, 150, 0, 0.5)'
const cellBarrierInnerColor = 'rgba(150, 200, 100, 0.6)'

const cellInnerColorLight = 'rgba(100, 255, 50, 0.1)'
const cellInnerColorDark = 'rgba(100, 150, 50, 0.5)'

const nucleusColor = 'rgba(20, 60, 50, 0.7)'

const shapeRecoveryMultiplier = 0.01
const breathInterval = 5000
const cellDetailsLevel = 2
const cellAnimationSpeed = 0.01
const cellControllabilityMultiplier = 0.3
const cellBrakingSpeed = 0.005
const cellSpeed = 0.05

const cellHairColor = 'rgba(20, 50, 0, 0.35)'
const cellHairLength = 12
const cellHairThickness = 1
const cellHairSpreadness = 4


//END OF CONFIGURABLE CONSTANTS

const mouse = {x: 0, y: 0}
let cnv, ctx, animationStart, cell, backgroundTexture, destination, bubbles, diatoms

window.addEventListener('DOMContentLoaded', init)
console.log('...loading')
function init() {
    console.log('...initialization')
    
    cnv = document.getElementById('cnv')

    backgroundTexture = document.getElementById('bg')
    cytoplasmaTexture = document.getElementById('cytoplasma')
    diatomTexture = document.getElementById('diatom')

    const texturesLoading = Promise.all(
        [
            new Promise((resolve, reject) => {
                backgroundTexture.addEventListener('load', () => resolve())
                backgroundTexture.addEventListener('error', err => reject(err))
            }),
            new Promise((resolve, reject) => {
                cytoplasmaTexture.addEventListener('load', () => resolve())
                cytoplasmaTexture.addEventListener('error', err => reject(err))
            }),
            new Promise((resolve, reject) => {
                diatomTexture.addEventListener('load', () => resolve())
                diatomTexture.addEventListener('error', err => reject(err))
            })
        ]
    )

    destination = new DestinationPointer(cnv.width / 1.2, cnv.height / 2)

    bubbles = [...Array(bubblesAmount)].map(() => {
        const x = randomNumber(0, cnv.width)
        const y = randomNumber(0, cnv.height)
        const size = randomNumber(bubbleMinSize, bubbleMaxSize)
        return new Bubble(x, y, size)
    })

    diatoms = [...Array(diatomsAmount)].map(() => {
        const x = randomNumber(0, cnv.width)
        const y = randomNumber(0, cnv.height)
        const size = randomNumber(diatomMinSize, diatomMaxSize)
        return new Diatom(x, y, size)
    })

    cnv.addEventListener('mousedown', event => {
        debugger
        destination.x = event.pageX - event.target.offsetLeft
        destination.y = event.pageY - event.target.offsetTop
        destination.timer = 0
    })

    ctx = cnv.getContext('2d')
    cell = new Cell(cnv.width / 2, cnv.height / 2, 100)

    console.log('...done')

    texturesLoading.then( () => {
        document.getElementById('loading-alert').innerHTML = ''
        requestAnimationFrame(step)
    })
}

function step(timestamp) {
    animationStart = animationStart || timestamp
    tick()
    if (animationStart + renderingInterval < timestamp) render()
    requestAnimationFrame(step)
}

function render() {
    drawBackground()
    bubbles.forEach(dot => dot.render())
    diatoms.forEach(diatom => diatom.render())
    destination.render()
    cell.render()
    if (debugMode) cell.renderDebugLines()
}

function tick() {
    destination.tick()
    bubbles.forEach(dot => dot.propagate())
    diatoms.forEach(diatom => diatom.propagate())
    cell.propagate()
}

class Cell {
    constructor(x, y, radius) {
        this.x = x
        this.y = y
        this.velocityX = 300
        this.velocityY = 300
        this.radius = radius
        this.cellWallNodes = []
        this.originalShape = []
        this.particles = []
        this.cellCenterOffset = []

        this.createCellWall()
        this.createParticles()
    }

    propagate() {
        this.particles.forEach(particle => {
            particle.parentX = this.x
            particle.parentY = this.y  
            particle.centerOffsetX = this.cellCenterOffset[0]
            particle.centerOffsetY = this.cellCenterOffset[1]
        })

        this.cellWallNodes.forEach(curve => {
            curve.parentX = this.x
            curve.parentY = this.y
            curve.propagate()
        })
        this.updateCellCenterOffset()

        this.x += this.cellCenterOffset[0] * cellSpeed
        this.y += this.cellCenterOffset[1] * cellSpeed

        if (this.x < 0) this.x = 0
        if (this.y < 0) this.y = 0
        if (this.x > cnv.width) this.x = cnv.width
        if (this.y > cnv.height) this.y = cnv.height
    }
 
    createParticles() {
        const maxOffsetFromCenter = this.radius * cellParticlesSpreadnessRadius
        this.particles = [...Array(cellParticlesAmount)].map(() => {
            const x = randomNumber(-maxOffsetFromCenter / 2, maxOffsetFromCenter / 2)
            const y = randomNumber(-maxOffsetFromCenter / 2, maxOffsetFromCenter / 2)
            return new Particle(x, y)
        })
    }

    updateCellCenterOffset() {
        const vectorsSum = this.cellWallNodes.reduce((accumulator, value) => {
            const x = accumulator[0] + value.x
            const y = accumulator[1] + value.y
            return [x, y]
        }, [0, 0])

        const averageVector = [
            vectorsSum[0] / this.cellWallNodes.length,
            vectorsSum[1] / this.cellWallNodes.length
        ]

        this.cellCenterOffset = averageVector
    }

    createCellWall() {
        let dots = 4 * cellDetailsLevel
        this.cellWallNodes = [...Array(dots)].map((curve, index) => {
            const tiltFromPreviousNode = calculateNodeTilt(index, dots)
            const x = this.radius * Math.cos(tiltFromPreviousNode)
            const y = this.radius * Math.sin(tiltFromPreviousNode)
            const controlPointDistanceFromNode = 
                calculateOptimalDistanceForBezierControlPoints(dots, this.radius)

            const controlPoint1X = 
                controlPointDistanceFromNode * Math.cos(Math.PI * 0.25 + tiltFromPreviousNode)
            const controlPoint1Y = 
                controlPointDistanceFromNode * Math.sin(Math.PI * 0.25 + tiltFromPreviousNode)
            const controlPoint2X = 
                controlPointDistanceFromNode * Math.cos(Math.PI * 1.5 + tiltFromPreviousNode)
            const controlPoint2Y = 
                controlPointDistanceFromNode * Math.sin(Math.PI * 1.5 + tiltFromPreviousNode)

            return new CellWallNode(
                x,
                y,
                controlPoint1X,
                controlPoint1Y,
                controlPoint2X,
                controlPoint2Y
            )
        })

        function calculateOptimalDistanceForBezierControlPoints(amountOfNodes, radius) {
            return (4/3) * Math.tan(Math.PI / (amountOfNodes * 2)) * radius
        }

        function calculateNodeTilt(nodeNumber, totalAmountOfNodes) {
            const fullCircleAngle = 2 * Math.PI
            return (nodeNumber / totalAmountOfNodes) * fullCircleAngle
        }
    }

    render() {
        this.renderHair()
        this.renderCytoplasma()
        this.renderWall()
        this.renderNucleus()
        this.renderParticles()
    }

    renderHair() {
        this.plotPathOfCellBarrier()
        ctx.lineDashOffset = 2;
        ctx.setLineDash([cellHairThickness, cellHairSpreadness])
        ctx.strokeStyle = cellHairColor
        ctx.lineWidth = cellHairLength
        ctx.stroke()
        ctx.lineDashOffset = 0;
        ctx.setLineDash([])
    }

    renderCytoplasma() {
        this.plotPathOfCellBarrier()
        ctx.fillStyle = ctx.createPattern(cytoplasmaTexture,"repeat")
        ctx.translate(cytoplasmaTexture.width / 2, cytoplasmaTexture.height / 2)
        ctx.globalAlpha = 0.6
        ctx.filter = 'blur(3px)'
        ctx.scale( 1 + this.cellCenterOffset[0] / 50, 1 + this.cellCenterOffset[1] / 50)
        ctx.globalCompositeOperation = 'multiply'
        ctx.fill()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.globalAlpha = 1
        ctx.filter = 'none'
        ctx.globalCompositeOperation = 'source-over'
        this.plotPathOfCellBarrier()
        const grd = ctx.createRadialGradient(this.x, this.y , this.radius / 1.7, this.x, this.y, this.radius * 1.2)
        grd.addColorStop(0, cellInnerColorLight)
        grd.addColorStop(1, cellInnerColorDark)
        ctx.fillStyle = grd
        ctx.fill()
    }

    renderWall() {
        this.plotPathOfCellBarrier()
        ctx.strokeStyle = cellBarrierOuterColor
        ctx.lineWidth = 4
        ctx.stroke()
        
        this.plotPathOfCellBarrier()
        ctx.strokeStyle = ctx.createPattern(backgroundTexture,"repeat")
        ctx.lineWidth = 2
        ctx.stroke()
    }

    renderNucleus() {
        ctx.fillStyle = nucleusColor
        const centerOfCell = [this.cellCenterOffset[0] + this.x, this.cellCenterOffset[1] + this.y]
        ctx.filter = 'blur(3px)'
        plotCirclePath(centerOfCell[0], centerOfCell[1], this.radius / 7)
        ctx.fill()
        ctx.filter = 'none'
    }
    //TODO refactor
    renderParticles() {
        ctx.fillStyle = cytoplasmaParticlesColor
        const centerOffset = [...this.cellCenterOffset]
        this.particles.forEach(particle => particle.render(centerOffset))
    }

    plotPathOfCellBarrier() {
        ctx.beginPath()

        const lastNode = this.cellWallNodes[this.cellWallNodes.length - 1]

        ctx.moveTo(
            lastNode.x + this.x,
            lastNode.y + this.y
        )

        this.cellWallNodes.forEach((curve, index, list) => {
            const previousCurve = list[index - 1] || list[list.length - 1]
            const previousCurveLineEndpointX = previousCurve.x + this.x
            const previousCurveLineEndpointY = previousCurve.y + this.y
            const lineEndpointX = curve.x + this.x
            const lineEndpointY = curve.y + this.y
            
            ctx.bezierCurveTo(
                previousCurveLineEndpointX + curve.controlPoint1X,
                previousCurveLineEndpointY + curve.controlPoint1Y,
                lineEndpointX + curve.controlPoint2X,
                lineEndpointY + curve.controlPoint2Y,
                lineEndpointX,
                lineEndpointY
            )
        })
        ctx.closePath()
    }

    renderDebugLines() { //visible only in debug mode
        ctx.strokeStyle = 'pink'
        this.cellWallNodes.forEach((curve, index, list) => {
            const previousCurve = list[index - 1] || list[list.length - 1]
            const previousCurveLineEndpointX = previousCurve.x + this.x
            const previousCurveLineEndpointY = previousCurve.y + this.y
            const lineEndpointX = curve.x + this.x
            const lineEndpointY = curve.y + this.y
            ctx.beginPath()
            ctx.moveTo(
                previousCurveLineEndpointX,
                previousCurveLineEndpointY
            )
            ctx.lineTo(
                previousCurveLineEndpointX + curve.controlPoint1X,
                previousCurveLineEndpointY + curve.controlPoint1Y
            )
            ctx.closePath()
            ctx.stroke()
        })

        ctx.strokeStyle = 'red'
        this.cellWallNodes.forEach((curve, index, list) => {

            const previousCurve = list[index - 1] || list[list.length - 1]
            const previousCurveLineEndpointX = previousCurve.x + this.x
            const previousCurveLineEndpointY = previousCurve.y + this.y
            const lineEndpointX = curve.x + this.x
            const lineEndpointY = curve.y + this.y
            ctx.beginPath()
            ctx.moveTo(
                lineEndpointX,
                lineEndpointY
            )
            ctx.lineTo(
                lineEndpointX + curve.controlPoint2X,
                lineEndpointY + curve.controlPoint2Y
            )
            ctx.closePath()
            ctx.stroke()
        })
        ctx.strokeStyle = 'blue'
        ctx.beginPath()
        ctx.moveTo(this.x, this.y)
        ctx.lineTo(this.x + this.cellCenterOffset[0] * 5, this.y + this.cellCenterOffset[1] * 5)
        ctx.closePath()
        ctx.stroke()

        this.cellWallNodes.forEach((curve, index) => {
            ctx.strokeStyle = 'lime'
            const initialPosition = this.originalShape[index]
            ctx.beginPath()
            ctx.moveTo(this.x + curve.x, this.y + curve.y)
            ctx.lineTo(this.x + initialPosition.x, this.y + initialPosition.y)
            ctx.closePath()
            ctx.stroke()
        })
    }
}

class Particle {
    constructor(x, y) {
        this.x = x
        this.y = y
        this.size = randomNumber(cellParticleMinSize, cellParticleMaxSize)
        this.distanceFromCellCenter = Math.random()
        this.speedMultiplierX = Math.random()
        this.speedMultiplierY = Math.random()
        this.color = cellParticleColorFormula()
        this.parentX = 0
        this.parentY = 0
        this.centerOffsetX = 0
        this.centerOffsetY = 0
    }

    render() {
        const leeway = (cellParticleMaxSize / this.size) * 2
        const absolutePositionX = this.parentX + (this.centerOffsetX + this.x) * this.distanceFromCellCenter + this.centerOffsetX * leeway * this.speedMultiplierX
        const absolutePositionY = this.parentY + (this.centerOffsetY + this.y) * this.distanceFromCellCenter + this.centerOffsetY * leeway * this.speedMultiplierY
        plotCirclePath(absolutePositionX, absolutePositionY, this.size)
        if (this.size + 1 >= cellParticleMaxSize) ctx.globalAlpha = 0.3
        ctx.fill()
        ctx.globalAlpha = 1
    }
}

class CellWallNode {
    constructor(x, y, controlPoint1X, controlPoint1Y, controlPoint2X, controlPoint2Y) {
        this.x = x
        this.y = y
        this.controlPoint1X = controlPoint1X
        this.controlPoint1Y = controlPoint1Y
        this.controlPoint2X = controlPoint2X
        this.controlPoint2Y = controlPoint2Y
        this.changeDirectionX = Math.random() < 0.5 ? -1 : 1
        this.changeDirectionY = Math.random() < 0.5 ? -1 : 1
        this.timer = 0.01
        this.timerDirection = 1

        this.initialX = x
        this.initialY = y
        this.parentX = 0
        this.parentY = 0
    }

    initialShapeRecoveryStep() {
        this.x -= (this.x - this.initialX) * shapeRecoveryMultiplier
        this.y -= (this.y - this.initialY) * shapeRecoveryMultiplier
    }

    propagate() {
        if (this.timer >= 1 || this.timer <= 0) {
            const isDestinationOnRight = destination.x - this.parentX
            const isDestinationAbove = destination.y - this.parentY
            const preferredDirectionX = isDestinationOnRight > 0 ? 1 : -1
            const preferredDirectionY = isDestinationAbove > 0 ? 1 : -1

            this.changeDirectionX = Math.random() > cellControllabilityMultiplier ?
                preferredDirectionX : -preferredDirectionX
            this.changeDirectionY = Math.random() > cellControllabilityMultiplier ? 
                preferredDirectionY : -preferredDirectionY

            this.timer = 0
        }
        this.changeDirectionX /= 1 + cellBrakingSpeed
        this.changeDirectionY /= 1 + cellBrakingSpeed
        this.timer+= cellAnimationSpeed
        
        this.x+= this.changeDirectionX * easeInOutCubic(this.timer) * 0.3
        this.y+= this.changeDirectionY * easeInOutCubic(this.timer) * 0.3
        this.initialShapeRecoveryStep()
    }
}
class DestinationPointer {
    constructor(x, y) {
        this.x = x
        this.y = y
        this.timer = 0.01
    }

    render() {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
        ctx.fillStyle = `rgba(255, 255, 255, 0.8)`
        const animationFrame = Math.abs((this.timer % 1) - 0.5)
        const outerCircleSize = easeInOutCubic(animationFrame) * (destinationPointerSize - 5) + 5
        plotCirclePath(this.x, this.y, outerCircleSize)
        ctx.stroke()

        const innerCircleSize = destinationPointerSize / 6
        plotCirclePath(this.x, this.y, innerCircleSize)
        ctx.fill()
        ctx.textAlign = 'center'
        ctx.fillText('Come here', this.x, this.y - 20)
    }

    tick() {
        if (this.timer < 0.5) this.timer += destinationPointerAnimationSpeed
    }
}

class Bubble {
    constructor(x,y, size) {
        this.x = x
        this.y = y
        this.size = size
        this.velocityX = 0
        this.velocityY = 0
        this.timer = Math.random()
    }

    propagate() {
        this.timer += 0.001 * Math.random()
        this.x += this.velocityX
        this.y += this.velocityY

        this.velocityX += randomNumber(-0.005, 0.005)
        this.velocityY += randomNumber(-0.005, 0.005)

        if (cnv.width < this.x) {
            this.x = cnv.width
            this.velocityX *= -1
        }
        if (cnv.height < this.y) {
            this.y = cnv.height
            this.velocityY *= -1
        }
        if (0 > this.x) {
            this.x = 0
            this.velocityX *= -1
        }
        if (0 > this.y) {
            this.y = 0
            this.velocityY *= -1
        }
    }

    render() {
        const controllerValue = Math.abs((this.timer % 1)-0.5)
        const alpha = easeInOutCubic(controllerValue) - 0.2
        const visibility = alpha > 0 ? alpha : 0

        if (visibility === 0) return

        const specularGradient = ctx.createRadialGradient(this.x, this.y + this.size / 10, this.size, this.x, this.y, this.size / 1.3)
        specularGradient.addColorStop(0, 'white')
        specularGradient.addColorStop(1, 'transparent')
        ctx.fillStyle = specularGradient
        plotCirclePath(this.x, this.y, this.size)
        ctx.globalAlpha = visibility
        ctx.globalCompositeOperation = 'xor'
        ctx.fill()
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = '1'
    }
}

class Diatom {
    constructor(x, y, size) {
        this.x = x
        this.y = y
        this.velocityX = 0
        this.velocityY = 0
        this.size = size
        this.rotation = 0
    }

    propagate() {
        this.rotation += 0.3 / this.size
        this.x += this.velocityX
        this.y += this.velocityY
                
        this.velocityX += randomNumber(-0.01, 0.01)
        this.velocityY += randomNumber(-0.01, 0.01)

        if (Math.abs(this.velocityX) > 0.1) this.velocityX /= 1.5
        if (Math.abs(this.velocityY) > 0.1) this.velocityY /= 1.5

        if (cnv.width < this.x) {
            this.x = cnv.width
            this.velocityX = -this.velocityX
        }

        if (cnv.height < this.y) {
            this.y = cnv.height
            this.velocityY = -this.velocityY
        }

        if (0 > this.x) {
            this.x = 0
            this.velocityX = -this.velocityX
        }

        if (0 > this.y) {
            this.y = 0
            this.velocityY = -this.velocityY
        }
    }

    render() {
        ctx.globalAlpha = 0.2
        ctx.translate(this.x + this.size / 2, this.y + this.size / 2)
        ctx.rotate(this.rotation)
        ctx.translate(-this.x - this.size / 2, -this.y - this.size / 2)
        ctx.drawImage(diatom, this.x, this.y, this.size, this.size)
        
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.globalAlpha = 1
    }
}

function drawBackground() {
    ctx.fillStyle = ctx.createPattern(backgroundTexture, 'repeat')
    ctx.fillRect(0, 0, cnv.width, cnv.height)
}

function createArrayFilledWithNulls(length) {
    return new Array(bubblesAmount).fill(null)
}

function randomNumber(min, max) {
    return Math.random() * (max - min) + min
}

function calculateDistance(x1, y1, x2, y2) {
    const xDistance = x1 - x2
    const yDistance = y1 - y2
    return Math.abs(Math.sqrt(xDistance * xDistance + yDistance * yDistance))
}

function easeInOutCubic(t) {
    return t < 0.5 ? 16 * (t ** 5) : 1 + 16 * (--t) * (t ** 4)
}

function plotCirclePath(x, y, size) {
    ctx.beginPath()
    ctx.arc(x, y, size , 0, 2 * Math.PI)
    ctx.closePath()
}