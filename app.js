const express = require("express")
const bodyparser = require("body-parser")
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const app = express()
const jimp = require("jimp")
const dotEnv = require("dotenv").config()
const cloudinary = require("cloudinary").v2


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (fs.existsSync("./uploads")) {
            cb(null, "uploads")
            return
        }
        fs.mkdirSync("./uploads")
        cb(null, "uploads")

    },
    filename: function (req, file, cb) {
        const fileExt = path.extname(file.originalname);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + fileExt);
    }
})

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
        fileCount: 1,
    },

})
app.use(bodyparser.urlencoded({ extended: false }))
app.use(bodyparser.json())

cloudinary.config({
    api_key: process.env.API_KEY,
    cloud_name: process.env.CLOUD_NAME,
    api_secret: process.env.API_SECRET
})
app.post("/upload", upload.single("image"), async (req, res, next) => {
    const watermarkText = req.body.watermarkText;
    let angleOfRotation = req.body.angleOfRotation;
    if (!watermarkText || !angleOfRotation) {
        return res.status(400).json({ status: "error", message: "Please submit the watermarkText and angleOfRotation in the request body, and a image field" })
    }
    try {
        angleOfRotation = parseInt(angleOfRotation)
        const read = await jimp.read(`uploads/${req.file.filename}`)
        if (!fs.existsSync("./edited")) {
            fs.mkdirSync("./edited")
        }
        const font = await jimp.loadFont(jimp.FONT_SANS_64_WHITE)

        const diagonalLength = Math.sqrt(Math.pow(read.bitmap.width, 2) + Math.pow(read.bitmap.height, 2));
        const image2 = new jimp(read.bitmap.width, read.bitmap.height, "black")
        for (let i = 0; i < read.bitmap.height; i += (font.info.size * (watermarkText.length + 1))) {
            for (let j = 0; j < read.bitmap.width; j += (font.info.size * 2)) {
                image2.print(font, i, j, watermarkText)
            }
        }
        image2.blur(3).rotate(45).opacity(0.3)

        read
            .composite(image2, 0, 0)
            .write(`edited/${req.file.filename}`)

        const uploaded = await cloudinary.uploader.upload(`edited/${req.file.filename}`, {
            folder: "thumbnail"
        })
        fs.unlinkSync(`uploads/${req.file.filename}`)
        fs.unlinkSync(`edited/${req.file.filename}`)
        res.status(200).json({ status: "sucess", url: uploaded.url })
    } catch (err) {
        return res.status(400).json({ status: "error", message: err.message })
    }
})
app.get("/health", (req, res, next) => {
    res.status(200).json({ status: "sucess" })
})
app.use("*", (req, res, next) => {
    res.status(404).json({ status: "error", message: "Incorrect Route or method" })
})

app.listen(3000)