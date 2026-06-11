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

  Promise.all(req.body.events.map(handleEvent))
    .then(() => {
      console.log('Processed successfully');
    })
    .catch((err) => {
      console.error('Webhook Error:', err);
    });
});

async function handleEvent(event) {

  const myGoogleSheetLink =
    process.env.MY_GOOGLE_SHEET_LINK ||
    'https://google.com';

  let displayName = 'ไม่ระบุชื่อไลน์';

  try {

    if (event.source && event.source.userId) {

      let profile;

      if (event.source.groupId) {

        profile = await client.getGroupMemberProfile({
          groupId: event.source.groupId,
          userId: event.source.userId
        });

      } else {

        profile = await client.getProfile({
          userId: event.source.userId
        });

      }

      if (profile && profile.displayName) {
        displayName = profile.displayName;
      }
    }

  } catch (error) {
    console.error('Cannot get profile:', error);
  }

  // -------------------------
  // รับข้อความ
  // -------------------------
  if (
    event.type === 'message' &&
    event.message.type === 'text'
  ) {

    const userText = event.message.text;

    try {

      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [
          {
            type: 'text',
            text: `📝 บอทได้รับข้อความ "${userText}" เรียบร้อยครับ`
          }
        ]
      });

    } catch (error) {
      console.error('Reply text error:', error);
    }

    return;
  }

  // -------------------------
  // รับรูปภาพ
  // -------------------------
  if (
    event.type === 'message' &&
    event.message.type === 'image'
  ) {

    try {

      const messageId = event.message.id;

      console.log(
        `Image received from ${displayName} : ${messageId}`
      );

      if (process.env.GOOGLE_SHEET_URL) {

        await axios.post(
          process.env.GOOGLE_SHEET_URL,
          {
            type: 'image',
            userName: displayName,
            messageId: messageId,
            token: config.channelAccessToken
          },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        console.log('Image data sent to Google Sheet');
      }

      const replyText =
        `📸 บอทบันทึกรูปของ ${displayName} เรียบร้อยแล้ว\n\n` +
        `📂 ดูคลังรูปภาพทั้งหมดได้ที่\n${myGoogleSheetLink}`;

      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [
          {
            type: 'text',
            text: replyText
          }
        ]
      });

    } catch (error) {

      console.error('Image process error:', error);

      try {

        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: 'text',
              text: '❌ เกิดข้อผิดพลาดในการบันทึกรูปภาพ'
            }
          ]
        });

      } catch (replyError) {
        console.error(replyError);
      }
    }

    return;
  }

  return;
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
