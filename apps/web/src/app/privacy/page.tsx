import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalDocument, LegalSection } from '@/components/legal/LegalDocument'

export const metadata: Metadata = {
  title: 'Privacy Policy — GAME.',
  description: 'What GAME. collects and how Klimova Alena uses it.',
}

export default function PrivacyPage() {
  return (
    <LegalDocument title="PRIVACY" updated="Updated 29 September 2026">
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

      <LegalSection title="ACCOUNT">
        <p>
          If you register with email, we store your email address and a password. The password is kept by our sign-in provider in a form we cannot read. If you continue with Google, Google sends us the name, email address, and profile photo on that Google account.
        </p>
      </LegalSection>

      <LegalSection title="PROFILE">
        <p>
          You can add a name, username, photo, short bio, city, playing level, how long you have played, preferred format, surface and style, the days and times you are free, and who you want to play with. Other players can see your profile.
        </p>
      </LegalSection>

      <LegalSection title="LOCATION">
        <p>
          The city on your profile is used to show players, games, and courts near you. If you ask the app to use your location, the browser requests permission and we use that position for the search. GAME. does not follow your location in the background. A city or a recent search area may stay on your device so the next visit opens where you left it.
        </p>
      </LegalSection>

      <LegalSection title="GAMES, CHATS, AND POSTS">
        <p>
          When you create or join a game, we store the time, place, format, and the players. A personal chat is visible to the two people in it. A game chat is visible to people who hold a seat in that game, for the time they are in it. Posts and photos you publish are visible to other players.
        </p>
      </LegalSection>

      <LegalSection title="SUPPORT">
        <p>If you write to support, we store the message and any photo you attach, together with your account, so we can read the request and reply.</p>
      </LegalSection>

      <LegalSection title="COOKIES">
        <p>The app uses cookies that are required to keep you signed in. It does not use advertising cookies or analytics cookies.</p>
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
