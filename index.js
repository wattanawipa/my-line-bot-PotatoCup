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
  
  // ตรวจสอบห้องแชทและดึงชื่อผู้ส่ง
  let userName = "ไม่ระบุชื่อ";
  try {
    if (event.source.userId) {
      let profile;
      if (event.source.groupId) {
        // ถ้าส่งในกลุ่ม ให้ดึงโปรไฟล์จากในกลุ่ม
        profile = await client.getGroupMemberProfile({
          groupId: event.source.groupId,
          userId: event.source.userId
        });
      } else {
        // ถ้าส่งแชทส่วนตัว
        profile = await client.getProfile({ userId: event.source.userId });
      }
      if (profile && profile.displayName) {
        userName = profile.displayName;
      }
    }
  } catch (error) {
    console.error("Cannot get profile:", error);
  }

  // 1. รับข้อความตัวอักษรธรรมดา
  if (event.type === 'message' && event.message.type === 'text') {
    const userText = event.message.text;
    
    if (process.env.GOOGLE_SHEET_URL) {
      await axios.post(process.env.GOOGLE_SHEET_URL, {
        type: 'text',
        userName: userName,
        data: userText
      }).catch(e => console.error(e));
    }

    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: `📝 บอทบันทึกข้อความ "${userText}" ของคุณ ${userName} เรียบร้อยครับ!` }]
    });
  }

  // 2. รับรูปภาพ พร้อมแนบลิงก์รูปของ LINE และส่งชื่อคนส่งไปบันทึกด้วย
  if (event.type === 'message' && event.message.type === 'image') {
    const messageId = event.message.id;
    
    // สร้างพารามิเตอร์ส่งรูปภาพไปให้ Google Sheet แปลงเป็นรูปจริง
    const lineImageUrl = `https://line.me{messageId}/content?access_token=${config.channelAccessToken}`;

    if (process.env.GOOGLE_SHEET_URL) {
      await axios.post(process.env.GOOGLE_SHEET_URL, {
        type: 'image',
        userName: userName,
        data: lineImageUrl
      }).catch(e => console.error(e));
    }

    const replyText = `📸 บอทเซฟรูปของคุณ ${userName} เข้าคลังถาวรเรียบร้อยครับ!\n\n📂 เปิดดูคลังรูปภาพทั้งหมดของกลุ่มได้ที่นี่:\n${myGoogleSheetLink}`;

    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: replyText }]
    });
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
