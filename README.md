# Connect & Chat

Build a mobile-first PWA called WHATSXUP, a modern real-time messaging app.



Use:



- React + TypeScript

- Supabase Auth + PostgreSQL + Realtime + Storage

- Vercel deployment

- PWA manifest + service worker



Authentication



- Email + password only.

- NO phone numbers.

- NO Google/social login.

- NO email confirmation.

- Users should sign up and immediately enter the app.

- After signup, require them to create a unique username.



Username



- Username is how users find each other.

- Unique, 3–20 characters.

- Users can search usernames and send friend requests.

- Never expose email addresses publicly.



Messaging



Users can:



- Add/remove friends

- Send text messages

- Send images

- Send videos

- Record/send voice notes

- See online status

- See typing indicators

- See read receipts

- Delete/edit messages



Use Supabase Realtime for instant messaging.



Profiles



Users can:



- Upload profile pictures

- Change display name

- Change bio

- Manage privacy settings



Make the interface modern, responsive, fast, and installable as a PWA.



Do not copy WhatsApp branding or copyrighted assets.

Continue building WHATSXUP.



Add the complete friends and private messaging system.



Friends



- Search users by unique username.

- Show profile picture, display name, and username.

- Add Friend button.

- Friend requests: Accept / Decline.

- Friends list.

- Remove Friend.

- Block User.



Private Chats



Friends can start one-to-one chats.



Support:



- Text messages

- Images

- Videos

- Voice notes

- Reply to messages

- Edit/delete messages

- Read receipts

- Delivered status

- Typing indicator

- Online/offline status

- Unread message count



Use Supabase Realtime so messages appear instantly without refreshing.



Use Supabase Storage for images, videos, voice notes, and profile pictures.



Keep everything mobile-first, responsive, secure, and compatible with the WHATSXUP PWA.

Continue building WHATSXUP.



Add WhatsApp-style groups and voice/video calling.



Groups



Users can:



- Create groups.

- Set group name, picture, and description.

- Add friends.

- Remove members.

- Leave groups.

- Make members admins.

- Remove admin status.

- Edit group information.

- Send text, images, videos, and voice notes.



Group roles:



- Owner

- Admin

- Member



Add group settings for who can add members and who can edit group information.



Voice & Video Calls



Add one-to-one calling using WebRTC.



Include:



- Voice calls

- Video calls

- Accept/decline

- Mute microphone

- Turn camera on/off

- End call

- Missed calls

- Call history



Use Supabase Realtime for WebRTC signaling.



Handle camera/microphone permissions properly and show clear errors when permission is denied.



Keep everything responsive and compatible with the WHATSXUP PWA.

Continue building WHATSXUP.



Add a secure Master Admin Panel.



Admin Dashboard



Show:



- Total users

- Online users

- Total chats

- Total groups

- Messages

- Calls

- Reports

- Suspended/banned users



User Management



Admin can:



- Search users by username.

- View user profiles.

- Suspend/unsuspend users.

- Ban/unban users.

- Delete accounts.

- Force username changes.

- Remove inappropriate profile pictures/bios.



Group Management



Admin can:



- View groups.

- Review reported groups.

- Remove violating groups.

- Suspend problematic groups.



Reports



Users can report:



- Users

- Messages

- Groups

- Images/videos



Admin can review, resolve, reject, suspend, or ban when necessary.



Security



- Only the Master Admin can access "/admin".

- Use Supabase Auth + RLS + backend authorization.

- Never rely only on frontend admin checks.

- Users must never be able to make themselves admin.

- Protect private chats and groups.

- Never expose Supabase service-role keys.

- Add server-side rate limits for spam.

- Log every admin action in an audit log.

- Require confirmation for permanent deletion and bans.

- Support optional 2FA/MFA for the Master Admin.



Privacy



Do not create unrestricted access for the admin to read everyone's private chats. Only allow message-content review when required for a legitimate report/moderation process, with access logged.



Make the Admin Panel responsive and secure, and keep it part of the WHATSXUP PWA.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/104ad803-e169-40e9-b057-c1c0ad84cc72).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
