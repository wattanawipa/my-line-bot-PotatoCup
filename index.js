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
  const myGoogleSheetLink = process.env.MY_GOOGLE_SHEET_LINK || "https://google.com";
  
  // 🔍 ปรับปรุง: การดึงข้อมูลโปรไฟล์ของชื่อไลน์จากในกลุ่มด้วยรูปแบบอัปเดตล่าสุด
  let displayName = "ไม่ระบุชื่อไลน์";
  try {
    if (event.source && event.source.userId) {
      let profile;
      if (event.source.groupId) {
        // ดึงชื่อสมาชิกกลุ่มด้วยฟังก์ชัน Object Parameter ล่าสุดของ SDK
        profile = await client.getGroupMemberProfile({
          groupId: event.source.groupId,
          userId: event.source.userId
        });
      } else {
        // กรณีส่งแชทส่วนตัวหาบอทตรงๆ
        profile = await client.getProfile({ userId: event.source.userId });
      }
      if (profile && profile.displayName) {
        displayName = profile.displayName;
      }
    }
  } catch (error) {
    console.error("Cannot get profile name:", error);
  }

  // ไม่เก็บข้อความตัวอักษรลงตาราง (ตารางจะสะอาด)
  if (event.type === 'message' && event.message.type === 'text') {
    const userText = event.message.text;
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: `📝 บอทได้รับข้อความ "${userText}" เรียบร้อยครับ` }]
    });
  }

  // 📸 เก็บเฉพาะรูปภาพและยิงส่งไปให้ Google Sheet วาดรูป
  if (event.type === 'message' && event.message.type === 'image') {
    const messageId = event.message.id;
    const lineImageUrl = `https://line.me{messageId}/content`;

    if (process.env.GOOGLE_SHEET_URL) {
      await axios.post(process.env.GOOGLE_SHEET_URL, {
        type: 'image',
        userName: displayName,
        data: lineImageUrl,
        token: config.channelAccessToken
      }).catch(e => console.error(e));
    }

    const replyText = `📸 บอทเซฟรูปของคุณ ${displayName} เข้าคลังถาวรเรียบร้อยครับ!\n\n📂 เปิดดูคลังรูปภาพทั้งหมดของกลุ่มได้ที่ลิงก์นี้:\n${myGoogleSheetLink}`;

    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: replyText }]
    });
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
