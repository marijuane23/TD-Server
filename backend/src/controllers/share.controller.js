import { MessageMediaModel } from '../models/messageMedia.model.js';
import { MessageModel } from '../models/message.model.js';
import { TeacherModel } from '../models/teacher.model.js';
import { config } from '../config/env.js';

export const ShareController = {
  // GET /share/media/:media_id
  async getSharePreview(req, res, next) {
    try {
      const { media_id } = req.params;
      const media = await MessageMediaModel.getById(media_id);

      if (!media) {
        return res.status(404).send('<!DOCTYPE html><html><body><h3>Media not found</h3></body></html>');
      }

      const message = await MessageModel.getById(media.message_id);
      const teacher = message ? await TeacherModel.getById(message.teacher_id) : null;

      const teacherName = teacher ? teacher.name : 'our beloved teachers';
      const teacherSlug = teacher ? teacher.slug : '';
      const redirectUrl = teacherSlug
        ? `${config.corsOrigin}/teachers/${teacherSlug}`
        : config.corsOrigin;

      const title = `Happy Teacher's Day: Tribute to ${teacherName}`;
      const description = message
        ? `"${message.message_text.slice(0, 160)}" — from ${message.sender_name}`
        : "Celebrating our wonderful teachers at BISU Bilar!";

      const mediaUrl = `${config.backendPublicUrl}/media/${media.id}`;
      const isVideo = media.media_type === 'video';

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="description" content="${description}">

  <!-- Facebook / Open Graph Meta Tags -->
  <meta property="og:type" content="${isVideo ? 'video.other' : 'website'}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${config.backendPublicUrl}/share/media/${media.id}">
  ${
    isVideo
      ? `<meta property="og:video" content="${mediaUrl}">
  <meta property="og:video:type" content="${media.media_mime}">`
      : `<meta property="og:image" content="${mediaUrl}">
  <meta property="og:image:type" content="${media.media_mime}">`
  }

  <!-- Immediate redirect for human visitors -->
  <meta http-equiv="refresh" content="0;url=${redirectUrl}">
  <script>
    window.location.replace(${JSON.stringify(redirectUrl)});
  </script>
</head>
<body style="font-family: sans-serif; text-align: center; padding: 40px;">
  <h2>Redirecting you to ${teacherName}'s timeline...</h2>
  <p>If you are not redirected automatically, <a href="${redirectUrl}">click here</a>.</p>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      next(err);
    }
  },
};
