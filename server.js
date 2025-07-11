import express from 'express';
import fetch from 'node-fetch';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const app = express();
const port = process.env.PORT || 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/output', express.static('public'));

app.get('/', (req, res) => {
  res.send(`
    <form method="POST" action="/generate">
      <input type="text" name="videoUrl" placeholder="Enter video URL" style="width:300px" required />
      <button type="submit">Generate</button>
    </form>
  `);
});

app.post('/generate', async (req, res) => {
  const videoUrl = req.body.videoUrl;
  const inputFile = path.join(__dirname, 'input.mp4');
  const outputDir = path.join(__dirname, 'public');
  const spritePath = path.join(outputDir, 'sprite.jpg');
  const vttPath = path.join(outputDir, 'thumbnails.vtt');

  try {
    const response = await fetch(videoUrl);
    const fileStream = fs.createWriteStream(inputFile);
    await new Promise((resolve, reject) => {
      response.body.pipe(fileStream);
      response.body.on("error", reject);
      fileStream.on("finish", resolve);
    });

    const cmd = `ffmpeg -i "${inputFile}" -vsync vfr -vf "select='isnan(prev_selected_t)+gte(t-prev_selected_t\\,10)',scale=160:90,tile=10x10" -qscale:v 2 "${spritePath}"`;

    exec(cmd, (err) => {
      if (err) return res.send("FFmpeg error: " + err.message);

      // Generate thumbnails.vtt
      const vtt = ["WEBVTT\n"];
      let count = 0;
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          const start = count * 10;
          const end = start + 10;
          const left = x * 160;
          const top = y * 90;
          vtt.push(`${formatTime(start)}.000 --> ${formatTime(end)}.000\nsprite.jpg#xywh=${left},${top},160,90\n`);
          count++;
        }
      }
      fs.writeFileSync(vttPath, vtt.join('\n'));
      fs.unlinkSync(inputFile);

      res.send(`
        ✅ Done!<br><br>
        <a href="/output/sprite.jpg" target="_blank">View Sprite</a><br>
        <a href="/output/thumbnails.vtt" target="_blank">View VTT</a><br><br>
        <a href="/">← Try another</a>
      `);
    });
  } catch (e) {
    res.send("❌ Error: " + e.message);
  }
});

function formatTime(seconds) {
  const hrs = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
