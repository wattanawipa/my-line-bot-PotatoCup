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

app.post('/webhook', line.middleware(config), (req, res) => {
  res.status(200).end();
  Promise
    .all(req.body.events.map(handleEvent))
    .then(() => console.log('Processed successfully'))
    .catch((err) => console.error('Error:', err));
});

async function handleEvent(event) {
  // 1. เก็บข้อความตัวอักษรลง Google Sheet
  if (event.type === 'message' && event.message.type === 'text') {
    const userText = event.message.text;
    
    // ส่งข้อมูลไปบันทึกใน Google Sheet (ผ่านระบบ Web App)
    if (process.env.GOOGLE_SHEET_URL) {
      await axios.post(process.env.GOOGLE_SHEET_URL, {
        type: 'text',
        data: userText
      }).catch(e => console.error(e));
    }

    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: `📝 บอทบันทึกข้อความ "${userText}" ลง Google Sheet เรียบร้อยครับ!` }]
    });
  }

  // 2. เก็บไฟล์รูปภาพลง Google Sheet (เก็บเป็นลิงก์ไฟล์ของ LINE)
  if (event.type === 'message' && event.message.type === 'image') {
    const messageId = event.message.id;
    // ลิงก์รูปภาพของ LINE (สามารถนำไปเปิดดูในระบบหลังบ้านหรือเบราว์เซอร์ได้)
    const lineImageUrl = `https://line.me{messageId}/content`;

    if (process.env.GOOGLE_SHEET_URL) {
      await axios.post(process.env.GOOGLE_SHEET_URL, {
        type: 'image',
        data: lineImageUrl
      }).catch(e => console.error(e));
    }

    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ 
        type: 'text', 
        text: `📸 บอทเซฟลิงก์รูปภาพลงตาราง Google Sheet ให้เรียบร้อยแล้วครับ!` 
      }]
    });
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
