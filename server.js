import express from 'express';
import fetch from 'node-fetch';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const app = express();
const port = process.env.PORT || 8080;
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/output', express.static('public'));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Home page: input form
app.get('/', (req, res) => {
  res.send(`
    <form method="POST" action="/generate">
      <input type="text" name="videoUrl" placeholder="Enter video URL" style="width:300px" required />
      <button type="submit">Generate Thumbnails</button>
    </form>
  `);
});

// Processing route
app.post('/generate', async (req, res) => {
  const videoUrl = req.body.videoUrl;
  const inputFile = path.join(__dirname, 'input.mp4');
  const outputFolder = path.join(__dirname, 'public');
  const spritePath = path.join(outputFolder, 'sprite.jpg');
  const vttPath = path.join(outputFolder, 'thumbnails.vtt');

  try {
    // Download video
    const response = await fetch(videoUrl);
    const fileStream = fs.createWriteStream(inputFile);
    await new Promise((resolve, reject) => {
      response.body.pipe(fileStream);
      response.body.on("error", reject);
      fileStream.on("finish", resolve);
    });

    // Run FFmpeg to generate sprite
    const ffmpegCommand = `ffmpeg -i "${inputFile}" -vsync vfr -vf "select='isnan(prev_selected_t)+gte(t-prev_selected_t\\,10)',scale=160:90,tile=10x10" -qscale:v 2 "${spritePath}"`;

    exec(ffmpegCommand, (error) => {
      if (error) {
        res.send("FFmpeg failed: " + error.message);
        return;
      }

      // Generate VTT
      const vttLines = [];
      let count = 0;
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          const start = count * 10;
          const end = start + 10;
          const left = x * 160;
          const top = y * 90;
          vttLines.push(
            `${new Date(start * 1000).toISOString().substr(11, 8)}.000 --> ${new Date(end * 1000).toISOString().substr(11, 8)}.000\nsprite.jpg#xywh=${left},${top},160,90\n`
          );
          count++;
        }
      }

      fs.writeFileSync(vttPath, "WEBVTT\n\n" + vttLines.join("\n"));
      fs.unlinkSync(inputFile); // cleanup input file

      res.send(`
        ✅ Thumbnails Generated!<br><br>
        <a href="/output/sprite.jpg" target="_blank">View Sprite</a><br>
        <a href="/output/thumbnails.vtt" target="_blank">View VTT</a><br><br>
        <a href="/">← Generate Another</a>
      `);
    });
  } catch (e) {
    res.send("❌ Failed to download or process video: " + e.message);
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
