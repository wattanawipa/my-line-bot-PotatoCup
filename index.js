const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken
});

const blobClient = new line.messagingApi.MessagingApiBlobClient({
  channelAccessToken: config.channelAccessToken
});

app.post('/webhook', line.middleware(config), (req, res) => {
  res.status(200).end();
  Promise
    .all(req.body.events.map(handleEvent))
    .then(() => console.log('Processed successfully'))
    .catch((err) => console.error('Error:', err));
});

async function handleEvent(event) {
  // 1. รับข้อความตัวอักษรธรรมดา
  if (event.type === 'message' && event.message.type === 'text') {
    const userText = event.message.text;
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: ` ${userText}` }]
    });
  }

  // 2. รับรูปภาพจาก LINE แล้วส่งเข้าคลังถาวรของ Imgur
  if (event.type === 'message' && event.message.type === 'image') {
    const messageId = event.message.id;

    try {
      // ดึงรูปภาพดิบจาก LINE
      const response = await blobClient.getMessageContent(messageId);
      const chunks = [];
      for await (const chunk of response) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // ยิงส่งรูปภาพไปเก็บที่ Imgur
      const imgurResponse = await axios.post('https://imgur.com', buffer, {
        headers: {
          Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
          'Content-Type': 'application/octet-stream',
        },
      });

      // ดึงลิงก์รูปภาพถาวร
      const permanentUrl = imgurResponse.data.data.link;

      // พิมพ์ลิงก์ตอบกลับเข้าไปในแชท LINE
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ 
          type: 'text', 
          text: `📸 เซฟรูปเข้าคลังถาวรเรียบร้อยครับ!\nลิงก์ดูรูปฟรีตลอดไป:\n${permanentUrl}` 
        }]
      });

    } catch (err) {
      console.error('Imgur Upload Failed:', err.message);
    }
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
