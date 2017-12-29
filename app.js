//Graphics settings
const renderingInterval = 1000 / 60
const debugMode = false

//Environment objects
const bubblesAmount = 160
const bubbleMinSize = 4
const bubbleMaxSize = 10
const diatomsAmount = 4
const diatomMinSize = 10
const diatomMaxSize = 50

//Cell
const cytoplasmaMaxParticlesSize = 3
const cytoplasmaParticlesColor = 'rgba(20, 60, 60, 0.3)'
const cellBarrierOuterColor = 'rgba(10, 150, 0, 0.5)'
const cellBarrierInnerColor = 'rgba(150, 200, 100, 0.6)'
const cellInnerColorLight = 'rgba(100, 255, 50, 0.1)'
const cellInnerColorDark = 'rgba(100, 150, 50, 0.5)'
const nucleusColor = 'rgba(20, 60, 50, 0.7)'
const shapeRecoveryMultiplier = 0.01
const breathInterval = 5000
const cellDetailsLevel = 2

//END OF CONFIGURABLE CONSTANTS

const mouse = {x: 0, y: 0}
let cnv, ctx, animationStart, cell, backgroundTexture, destination, backgroundDots, diatoms

window.addEventListener('DOMContentLoaded', init)
console.log('...loading')
function init() {
    console.log('...initialization')
    destination = new DestinationPointer(500, 300)
    cnv = document.getElementById('cnv')
    backgroundTexture = document.getElementById('bg')
    cytoplasmaTexture = document.getElementById('cytoplasma')
    diatomTexture = document.getElementById('diatom')

    backgroundDots = [...Array(bubblesAmount)].map(() => {
        const x = randomNumber(0, cnv.width)
        const y = randomNumber(0, cnv.height)
        const size = randomNumber(bubbleMinSize, bubbleMaxSize)
        return new BackgroundDot(x, y, size)
    })

    diatoms = [...Array(diatomsAmount)].map(() => {
        const x = randomNumber(0, cnv.width)
        const y = randomNumber(0, cnv.height)
        const size = randomNumber(diatomMinSize, diatomMaxSize)
        return new Diatom(x, y, size)
    })

    cnv.addEventListener('mousemove', event => {
        mouse.x = event.clientX
        mouse.y = event.clientY
    })

    cnv.addEventListener('mousedown', event => {
        destination.x = event.clientX
        destination.y = event.clientY
    })

    ctx = cnv.getContext('2d')
    ctx.lineJoin = 'round'
    cell = new Cell(300, 300, 100)
    cell.createPoints()
    cell.createParticles()
    requestAnimationFrame(renderFrame)
    console.log('...done')
}

function renderFrame(timestamp) {
    //ctx.clearRect(0, 0, cnv.width, cnv.height)
    
    ctx.fillStyle = ctx.createPattern(backgroundTexture,"repeat")
    ctx.fillRect(0, 0, cnv.width, cnv.height)
    backgroundDots.forEach(dot => dot.render())
    diatoms.forEach(diatom => diatom.render())
    destination.render()
    animationStart = animationStart || timestamp
    let progress = timestamp - animationStart
    tick()
    cell.render()
    
    if (debugMode) cell.renderDebugLines()
    requestAnimationFrame(renderFrame)
}



function tick() {
    destination.tick()
    backgroundDots.forEach(dot => dot.propagate())
    diatoms.forEach(diatom => diatom.propagate())
    for (const [index, curve] of cell.bezierPoints.entries()) {
        if (curve.timer >= 1 || curve.timer <= 0) {
            const preferredDirectionX = (destination.x - cell.x) > 0 ? 1 : -1
            const preferredDirectionY = (destination.y - cell.y) > 0 ? 1 : -1
            curve.changeDirectionX = Math.random() > 0.3 ? preferredDirectionX : -preferredDirectionX
            curve.changeDirectionY = Math.random() > 0.3 ? preferredDirectionY : -preferredDirectionY
            curve.timer = 0
        }
        curve.changeDirectionX *= 0.995
        curve.changeDirectionY *= 0.995
        curve.timer+= 0.01
        
        curve.x+= curve.changeDirectionX * easeInOutCubic(curve.timer) * 0.3
        curve.y+= curve.changeDirectionY * easeInOutCubic(curve.timer) * 0.3
        
        curve.x -= (curve.x - cell.originalShape[index].x) * shapeRecoveryMultiplier
        curve.y -= (curve.y - cell.originalShape[index].y) * shapeRecoveryMultiplier
    }
    cell.updatecellCenterOffset()
}

class Cell {
    constructor(x, y, radius) {
        this.x = x
        this.y = y
        this.velocityX = 300
        this.velocityY = 300
        this.radius = radius
        this.bezierPoints = []
        this.originalShape = []
        this.particles = []
        this.cellCenterOffset = []
        this.ribbons = []
    }

    createRibbons() {

    }

    createParticles() {
        let dots = 150 * cellDetailsLevel
        const emptyList = new Array(dots)
        const listOfDummyParticlesCurves = emptyList.fill(null)
        const maxOffsetFromCenter = this.radius * 1.1

        this.particles = listOfDummyParticlesCurves.map(() => {
            const x = (Math.random() * maxOffsetFromCenter) - maxOffsetFromCenter / 2 
            const y = (Math.random() * maxOffsetFromCenter) - maxOffsetFromCenter / 2
            return new Particle(x, y)
        })
    }

    updatecellCenterOffset() {
        const averageVector = this.bezierPoints.reduce((accumulator, value) => {
            const x = accumulator[0] + value.x
            const y = accumulator[1] + value.y
            return [x, y]
        }, [0, 0])
        averageVector[0] /= this.bezierPoints.length
        averageVector[1] /= this.bezierPoints.length

        this.cellCenterOffset = averageVector
        return this.cellCenterOffset
    }

    createPoints() {
        let dots = 4 * cellDetailsLevel
        const emptyList = new Array(dots)
        const listOfDummyBezierCurves = emptyList.fill(null)
        this.bezierPoints = listOfDummyBezierCurves.map(
            (curve, index) => {
                const fullCircleAngle = 2 * Math.PI
                const angle = index ? (index / (dots)) * fullCircleAngle : 0
                const x = this.radius * Math.cos(angle)
                const y = this.radius * Math.sin(angle)
                const controlPointsStep = (4/3) * Math.tan(Math.PI / (dots * 2)) * this.radius
                const isEven = !(index % 2)

                const controlPoint1X = controlPointsStep * Math.cos(Math.PI * 0.25 + angle)
                const controlPoint1Y = controlPointsStep * Math.sin(Math.PI * 0.25 + angle)
                const controlPoint2X = controlPointsStep * Math.cos(Math.PI * 1.5 + angle)
                const controlPoint2Y = controlPointsStep * Math.sin(Math.PI * 1.5 + angle)

                return new CellBarrierNode(
                    x,
                    y,
                    controlPoint1X,
                    controlPoint1Y,
                    controlPoint2X,
                    controlPoint2Y
                )
            }
        )

        this.originalShape = JSON.parse(JSON.stringify(this.bezierPoints))
    }

    render() {

        this.plotPathOfCellBarrier()
        ctx.lineDashOffset = 2;
        ctx.setLineDash([1, 4])
        ctx.strokeStyle = 'rgba(20, 50, 0, 0.35)'
        ctx.lineWidth = 12
        ctx.stroke()
        ctx.lineDashOffset = 0;
        ctx.setLineDash([])


        this.plotPathOfCellBarrier()
        ctx.fillStyle = ctx.createPattern(cytoplasmaTexture,"repeat")
        ctx.translate(cytoplasmaTexture.width / 2, cytoplasmaTexture.height / 2)
        ctx.globalAlpha = '0.6'
        ctx.filter = 'blur(3px)'
        ctx.scale( 1 + this.cellCenterOffset[0] / 50, 1 + this.cellCenterOffset[1] / 50)
        ctx.globalCompositeOperation = 'multiply'
        ctx.fill()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.globalAlpha = '1'
        ctx.filter = 'none'
        ctx.globalCompositeOperation = 'source-over'


        this.plotPathOfCellBarrier()
        const grd = ctx.createRadialGradient(this.x, this.y , this.radius / 1.7, this.x, this.y, this.radius * 1.2)
        grd.addColorStop(0, cellInnerColorLight)
        grd.addColorStop(1, cellInnerColorDark)
        ctx.fillStyle = grd
        ctx.fill()

        this.plotPathOfCellBarrier()
        ctx.strokeStyle = cellBarrierOuterColor
        ctx.lineWidth = 4
        ctx.stroke()


        this.plotPathOfCellBarrier()
        ctx.strokeStyle = ctx.createPattern(backgroundTexture,"repeat")
        ctx.lineWidth = 2
        ctx.stroke()



        this.renderNucleus()
        const averageVector = [...this.cellCenterOffset]

        this.renderParticles()
        //this.renderSpeculars()

        this.x += averageVector[0] / 20
        this.y += averageVector[1] / 20
        if (this.x < 0) this.x = 0
        if (this.y < 0) this.y = 0
        if (this.x > cnv.width) this.x = cnv.width
        if (this.y > cnv.height) this.y = cnv.height

            
    }

    renderNucleus() {
        ctx.beginPath()
        ctx.fillStyle = nucleusColor
        
        const averageVector = [...this.cellCenterOffset]



        averageVector[0] = this.x + averageVector[0]
        averageVector[1] = this.y + averageVector[1]

        

        ctx.filter = 'blur(3px)'
        ctx.arc(averageVector[0], averageVector[1], this.radius / 7 , 0, 2 * Math.PI)
        ctx.closePath()
        ctx.fill()
        ctx.filter = 'none'

        return averageVector
    }

    renderParticles() {
        ctx.fillStyle = cytoplasmaParticlesColor
        const centerOffset = [...this.cellCenterOffset]
        this.particles.forEach(particle => {
            ctx.beginPath()
            const leeway = (cytoplasmaMaxParticlesSize / particle.size) * 2
            const absolutePositionX = this.x + (centerOffset[0] + particle.x) * particle.speed + centerOffset[0] * leeway * particle.speedX
            const absolutePositionY = this.y + (centerOffset[1] + particle.y) * particle.speed + centerOffset[1] * leeway * particle.speedY
            ctx.arc(absolutePositionX, absolutePositionY, particle.size , 0, 2 * Math.PI)
            ctx.closePath()
            if (particle.size + 1 >= cytoplasmaMaxParticlesSize) ctx.globalAlpha = 0.3
            ctx.fill()
            ctx.globalAlpha = 1
        })
    }

    renderSpeculars() {
        const centerOffset = [...this.cellCenterOffset]
        const specularGradient = ctx.createRadialGradient(this.x, this.y - 100, 60, this.x, this.y, 50)
        specularGradient.addColorStop(0, 'lime')
        specularGradient.addColorStop(1, 'transparent')
        ctx.beginPath()
        ctx.arc(this.x, this.y - this.radius / 2, 20, 0, 2* Math.PI)
        ctx.closePath()
        ctx.fillStyle = specularGradient
        ctx.globalCompositeOperation = 'xor'
        ctx.fill()
        ctx.beginPath()
        ctx.arc(this.x + this.radius / 2.5 + centerOffset[0] * 2, this.y - 30 + centerOffset[1] * 2, 10, 0, 2* Math.PI)
        ctx.closePath()
        ctx.fill()
        ctx.globalCompositeOperation = 'source-over'
    }

    plotPathOfCellBarrier() {
        ctx.beginPath()
        ctx.moveTo(
            this.bezierPoints[this.bezierPoints.length - 1].x + this.x,
            this.bezierPoints[this.bezierPoints.length - 1].y + this.y
        )

        this.bezierPoints.forEach((curve, index, list) => {
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

    renderDebugLines() {

        ctx.strokeStyle = 'pink'
        this.bezierPoints.forEach((curve, index, list) => {
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
        this.bezierPoints.forEach((curve, index, list) => {

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

        ctx.strokeStyle = 'black'

        ctx.strokeStyle = 'blue'
        ctx.beginPath()
        ctx.moveTo(this.x, this.y)
        ctx.lineTo(this.x + this.cellCenterOffset[0] * 5, this.y + this.cellCenterOffset[1] * 5)
        ctx.closePath()
        ctx.stroke()

        this.bezierPoints.forEach((curve, index) => {
            ctx.strokeStyle = 'lime'
            const initialPosition = this.originalShape[index]
            ctx.beginPath()
            ctx.moveTo(this.x + curve.x, this.y + curve.y)
            ctx.lineTo(this.x + initialPosition.x, this.y + initialPosition.y)
            ctx.closePath()
            ctx.stroke()
        })
    }

    applyForce() {

    }

    applyBarrierForceTo(target, barrier) {
        switch (target) {
            case 'cp1':

        }
    }
}

class Ribbon {
    constructor(x, y, length) {
        this.x = x
        this.y = y
        this.nodes = createNodes
    }

    createNodes(length) {
        const emptyArray = new Array(length)
        //return emptyArray.full(null).map(() => new )
    }

    render() {

    }
}

class CellBarrierNode {
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
    }
}

class Particle {
    constructor(x, y) {
        this.x = x
        this.y = y
        this.size = Math.random() * cytoplasmaMaxParticlesSize
        this.speed = Math.random()
        this.speedX = Math.random()
        this.speedY = Math.random()
        this.color = `rgba(${Math.round(Math.random() * 100)}, 100, 100, 0.3)`
    }
}

class DestinationPointer {
    constructor(x, y) {
        this.x = x
        this.y = y
        this.timer = 0.01
    }

    render() {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
        ctx.beginPath()
        const controllerValue = Math.abs((this.timer % 1)-0.5)
        const outerCircleSize = easeInOutCubic(controllerValue) * 15 + 5
        ctx.arc(this.x - 10, this.y - 10, outerCircleSize, 0, 2 * Math.PI)
        ctx.closePath()
        ctx.stroke()

        ctx.beginPath()
        const innerCircleSize = easeInOutCubic(controllerValue) * 6 + 2
        ctx.arc(this.x - 10, this.y - 10, innerCircleSize, 0, 2 * Math.PI)
        ctx.closePath()
        ctx.fill()
        ctx.textAlign = 'center'
        ctx.fillText('Come here', this.x -10, this.y - 30)
    }

    tick() {
        this.timer += 0.006
    }
}

function calculateDistance(x1, y1, x2, y2) {
    const xDistance = x1 - x2
    const yDistance = y1 - y2
    return Math.abs(Math.sqrt(xDistance*xDistance + yDistance*yDistance))
}

function easeInOutCubic(t) {
    return t<.5 ? 16*t*t*t*t*t : 1+16*(--t)*t*t*t*t
}

class BackgroundDot {
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

        this.velocityX += (Math.random() - 0.5) / 90
        this.velocityY += (Math.random() - 0.5) / 90

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
        //ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
        const specularGradient = ctx.createRadialGradient(this.x, this.y + this.size / 10, this.size, this.x, this.y, this.size / 1.3)
        specularGradient.addColorStop(0, 'white')
        specularGradient.addColorStop(1, 'transparent')
        
        ctx.fillStyle = specularGradient

        const controllerValue = Math.abs((this.timer % 1)-0.5)
        const alpha = easeInOutCubic(controllerValue) - 0.2
        
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, 2 * Math.PI)
        ctx.closePath()
        ctx.globalAlpha = alpha > 0 ? alpha : 0
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

        this.velocityX += (Math.random() - 0.5) / 50
        this.velocityY += (Math.random() - 0.5) / 50

        if (Math.abs(this.velocityX) > 0.1) this.velocityX /= 1.5
        if (Math.abs(this.velocityY) > 0.1) this.velocityY /= 1.5

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
        ctx.globalAlpha = 0.2
        ctx.translate(this.x + this.size / 2, this.y + this.size / 2)
        ctx.rotate(this.rotation)
        ctx.translate(-this.x - this.size / 2, -this.y - this.size / 2)
        ctx.drawImage(diatom, this.x, this.y, this.size, this.size)
        
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.globalAlpha = 1
    }
}

function createArrayFilledWithNulls(length) {
    return new Array(bubblesAmount).fill(null)
}

function randomNumber(min, max) {
    return Math.random() * (max - min) + min
}