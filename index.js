const express = require('express');
const line = require('@line/bot-sdk');

const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

// สร้าง Client สำหรับส่งข้อความเวอร์ชันล่าสุด
const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken
});

// Route สำหรับรับข้อมูล (Webhook) จาก LINE
app.post('/webhook', line.middleware(config), (req, res) => {
  // บังคับให้ตอบกลับ LINE ทันทีเพื่อไม่ให้เกิด Timeout
  res.status(200).end();

  // ประมวลผลข้อความเบื้องหลัง
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => console.log('Processed successfully'))
    .catch((err) => {
      console.error('Error handling event:', err);
    });
});

// ฟังก์ชันประมวลผลข้อความ
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  const userText = event.message.text;

  // ตั้งค่าข้อความตอบกลับ
  const echo = { type: 'text', text: `บอทได้รับคำว่า: ${userText}` };

  // เรียกใช้ฟังก์ชันตอบกลับเวอร์ชันใหม่
  try {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [echo]
    });
  } catch (err) {
    console.error('Error sending reply:', err);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});