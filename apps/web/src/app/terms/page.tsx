import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalDocument, LegalSection } from '@/components/legal/LegalDocument'

export const metadata: Metadata = {
  title: 'Terms of Use — GAME.',
  description: 'Rules for using GAME. — Find and Play Tennis.',
}

export default function TermsPage() {
  return (
    <LegalDocument title="TERMS" updated="Updated 29 September 2026">
      <LegalSection title="AGREEMENT">
        <p>
          These terms are an agreement between you and Klimova Alena for GAME. — Find and Play Tennis (“GAME.”). Creating an account means you agree to them and to the <Link href="/privacy" className="underline underline-offset-2 text-[#1a1a1a]">Privacy Policy</Link>. If you do not agree, do not use the app.
        </p>
      </LegalSection>

      <LegalSection title="AGE">
        <p>You must be at least 16 years old to create an account or use GAME.</p>
      </LegalSection>

      <LegalSection title="THE SERVICE">
        <p>
          GAME. helps people find tennis players, arrange games, chat, and share posts. It does not reserve courts and it does not take payments. A game in the app is an arrangement between players. Meeting someone in person is your own decision, and you are responsible for that meeting.
        </p>
      </LegalSection>

      <LegalSection title="YOUR ACCOUNT">
        <p>
          Keep your login to yourself. The name, photo, and other details on your profile should be yours. You may delete the account at any time in Settings. Deleting it is permanent.
        </p>
      </LegalSection>

      <LegalSection title="WHAT YOU POST">
        <p>
          You keep your rights to the text and photos you add. You allow GAME. to store them and show them to other players for as long as they remain in the app. Post only what you have the right to share.
        </p>
      </LegalSection>

      <LegalSection title="HOUSE RULES">
        <p>Do not harass, threaten, or impersonate anyone. Do not post anything illegal. Do not send spam. Do not try to access someone else’s account or interfere with the service.</p>
        <p>We may remove content or close an account that breaks these rules.</p>
      </LegalSection>

      <LegalSection title="CHATS">
        <p>
          A personal chat is between two people who follow each other. A game chat is for the people who hold a seat in that game. If you leave the game, you lose access to messages sent after you leave.
        </p>
      </LegalSection>

      <LegalSection title="NO GUARANTEE">
        <p>
          GAME. is provided as it is. Profiles, playing levels, and court details can be incomplete or wrong. We do not guarantee that a game will take place or that another player will arrive.
        </p>
      </LegalSection>

      <LegalSection title="LIABILITY">
        <p>
          To the extent the law allows, Klimova Alena is not liable for meetings you arrange through the app, for content other players post, or for loss that comes from using the service. These terms do not limit any liability that the law does not allow to be limited.
        </p>
      </LegalSection>

      <LegalSection title="CHANGES">
        <p>We may update these terms. The date at the top of this page will change. If you keep using GAME. after an update, you accept the new terms.</p>
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
