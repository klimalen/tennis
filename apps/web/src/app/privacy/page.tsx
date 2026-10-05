import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalDocument, LegalSection } from '@/components/legal/LegalDocument'

export const metadata: Metadata = {
  title: 'Privacy Policy — GAME. — Find and Play Tennis',
  description: 'How GAME. — Find and Play Tennis accesses, uses, stores, and shares Google user data and other account information.',
}

export default function PrivacyPage() {
  return (
    <LegalDocument title="PRIVACY POLICY" updated="Updated 5 October 2026">
      <LegalSection title="WHO WE ARE">
        <p>
          GAME. — Find and Play Tennis (“GAME.”) is operated by Klimova Alena. This policy describes the information the app collects, why it is collected, and the choices you have.
        </p>
        <p>
          Questions about your information: <a className="underline underline-offset-2 text-[#1a1a1a]" href="mailto:support@gametennisapp.com">support@gametennisapp.com</a>.
        </p>
      </LegalSection>

      <LegalSection title="WHO THIS IS FOR">
        <p>GAME. is for people who are at least 16 years old. We do not knowingly collect information from anyone younger.</p>
      </LegalSection>

      <LegalSection title="INFORMATION WE COLLECT">
        <p>We collect only what the app needs to find a game:</p>
        <p>Account. If you register with email, we store your email address and a password. The password is kept by our sign-in provider in a form we cannot read. If you continue with Google, Google sends us the name, email address, and profile photo on that Google account. We do not receive your Google password, your contacts, or anything else from your Google account.</p>
        <p>Profile. You can add a name, username, photo, short bio, city, playing level, how long you have played, preferred format, surface and style, the days and times you are free, and who you want to play with.</p>
        <p>Location. The city on your profile. If you ask the app to use your location, the browser requests permission and we use that position for the search. We do not follow your location in the background. A city or a recent search area may stay on your device so the next visit opens where you left it.</p>
        <p>Activity. Games you create or join, messages you send, posts and photos you publish, and support messages you write, including a photo you attach.</p>
        <p>Cookies. A cookie that keeps you signed in. We do not use advertising cookies or analytics cookies.</p>
      </LegalSection>

      <LegalSection title="HOW WE USE IT">
        <p>We use this information to create your account, keep you signed in, and show players, games, and courts near you. Chats and posts are shown to the people they are for. A support message is used to read the request and reply.</p>
        <p>We do not sell personal information. We do not use it for advertising. We do not use it to train models, and we do not use it to generate images of any kind.</p>
      </LegalSection>

      <LegalSection title="GOOGLE USER DATA">
        <p>
          This section describes how GAME. — Find and Play Tennis accesses, uses, stores, and shares Google user data. The only Google service in the app is Sign in with Google. We request your name, email address, and profile photo. We do not request Gmail, Drive, Calendar, Contacts, or any other Google data. We do not use Google user data to generate images, including non-consensual intimate imagery.
        </p>
        <p>Access. When you choose Continue with Google, Google gives us the name, email address, and profile photo of the account you pick. We do not receive your Google password.</p>
        <p>Use. We use that name, email address, and profile photo only to create or open your GAME. account and to show your name and photo to other players. We do not use Google user data for advertising, for sale, or to train a model.</p>
        <p>Store. We store the name, email address, and profile photo in your account for as long as the account exists. The account is stored by Supabase. The website is hosted by Vercel.</p>
        <p>Share. Other players can see the name and photo on your profile. We do not share your Google email address with other players. We do not sell Google user data. Google receives the sign-in request only because you chose Continue with Google.</p>
        <p>Delete. In Settings, choose Delete account and confirm. That deletes the Google name, email address, and profile photo we stored, together with the rest of the account.</p>
        <p>
          Use of information received from Google APIs follows the <a className="underline underline-offset-2 text-[#1a1a1a]" href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements.
        </p>
      </LegalSection>

      <LegalSection title="GAMES, CHATS, AND POSTS">
        <p>
          When you create or join a game, we store the time, place, format, and the players. A personal chat is visible to the two people in it. A game chat is visible to people who hold a seat in that game, for the time they are in it. Posts and photos you publish are visible to other players.
        </p>
      </LegalSection>

      <LegalSection title="WHO ELSE SEES IT">
        <p>Other players see the profile, games, chats, and posts you share with them.</p>
        <p>Supabase stores accounts, the database, and photos. Vercel hosts the website. Google receives a sign-in request only if you choose Continue with Google.</p>
        <p>We do not sell personal information.</p>
      </LegalSection>

      <LegalSection title="HOW LONG WE KEEP IT">
        <p>We keep this information while your account exists. Support messages stay so we can handle the request. After you delete the account, we delete the information described below.</p>
      </LegalSection>

      <LegalSection title="DELETING YOUR ACCOUNT">
        <p>
          In Settings, choose Delete account and confirm. This removes your profile, the games you created, your posts, your support messages, and the messages you sent. It cannot be undone. Content other people created stays theirs.
        </p>
      </LegalSection>

      <LegalSection title="CHANGES">
        <p>
          If this policy changes, the date at the top of the page changes with it. The current version is always at this address. The <Link href="/terms" className="underline underline-offset-2 text-[#1a1a1a]">Terms of Use</Link> explain the rules of the app.
        </p>
      </LegalSection>

      <LegalSection title="CONTACT">
        <p>
          Klimova Alena<br />
          <a className="underline underline-offset-2 text-[#1a1a1a]" href="mailto:support@gametennisapp.com">support@gametennisapp.com</a>
        </p>
      </LegalSection>
    </LegalDocument>
  )
}
