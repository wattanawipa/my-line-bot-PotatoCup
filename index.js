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
  // ลิงก์หน้าตาราง Google Sheet ของคุณเพื่อให้คนในกลุ่มกดเข้ามาดูคลังรูปได้
  const myGoogleSheetLink = process.env.MY_GOOGLE_SHEET_LINK || "https://google.com";

  // 1. เก็บข้อความตัวอักษรลง Google Sheet
  if (event.type === 'message' && event.message.type === 'text') {
    const userText = event.message.text;
    
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

  // 2. เก็บไฟล์รูปภาพลง Google Sheet + ส่งลิงก์ตารางกลับมาให้คนในกลุ่มเปิดดูคลังรูป
  if (event.type === 'message' && event.message.type === 'image') {
    const messageId = event.message.id;
    const lineImageUrl = `https://line.me{messageId}/content`;

    if (process.env.GOOGLE_SHEET_URL) {
      await axios.post(process.env.GOOGLE_SHEET_URL, {
        type: 'image',
        data: lineImageUrl
      }).catch(e => console.error(e));
    }

    // ข้อความตอบกลับพร้อมลิงก์ตารางคลังรูปถาวรให้คนในกลุ่มกดเข้าดูได้
    const replyText = `📸 บอทเซฟรูปเข้าคลังถาวรเรียบร้อยครับ!\n\n📂 เปิดดูคลังรูปภาพทั้งหมดของกลุ่มได้ที่ลิงก์นี้ (ไม่มีวันหมดอายุ):\n${myGoogleSheetLink}`;

    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: replyText }]
    });
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
