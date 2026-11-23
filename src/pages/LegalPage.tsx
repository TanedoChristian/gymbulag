/* Public privacy policy and data-deletion instructions (/privacy, /data-deletion), readable without logging in.
 * Google and Facebook ask for these URLs before sign-in with them can go live. */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

const UPDATED = '24 November 2026';
const CONTACT = __CONTACT_EMAIL__;

function Contact() {
  return CONTACT ? (
    <a className="font-semibold link-accent" href={`mailto:${CONTACT}`}>
      {CONTACT}
    </a>
  ) : (
    <span className="font-semibold">the app's administrator</span>
  );
}

function H({ children }: { children: ReactNode }) {
  return <h2 className="mt-8 font-display text-xl font-bold tracking-wide">{children}</h2>;
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <Link to="/" className="mb-6 inline-flex items-center gap-2">
        <img src="/icon.svg" alt="" className="h-8 w-8" />
        <span className="font-display text-lg font-bold tracking-wide">Gymbulag</span>
      </Link>
      <h1 className="font-display text-3xl font-bold tracking-wide">{title}</h1>
      <p className="mt-1 text-xs text-steel-mute dark:text-floor-mute">Last updated {UPDATED}</p>
      <div className="mt-4 space-y-3 text-sm leading-relaxed [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">{children}</div>
      <p className="mt-10 flex gap-4 text-xs">
        <Link className="link-accent" to="/privacy">
          Privacy policy
        </Link>
        <Link className="link-accent" to="/data-deletion">
          Delete your data
        </Link>
        <Link className="link-accent" to="/">
          Open Gymbulag
        </Link>
      </p>
    </div>
  );
}

function Privacy() {
  return (
    <Shell title="Privacy policy">
      <p>
        Gymbulag is a workout, food and progress log. This page explains what we store about you, why, and what you can do about it. We don't sell your data, show ads or use
        analytics or tracking tools.
      </p>

      <H>What we store</H>
      <ul>
        <li>
          <strong>Your account:</strong> name, email address, date of birth and your password (stored only as a one-way hash, never in readable form).
        </li>
        <li>
          <strong>Google or Facebook sign-in:</strong> if you sign in with Google or Facebook, we receive your name, email address and an account ID from that service. We use
          them only to create your account and log you in. We don't receive your Google or Facebook password, contacts, friends or posts, and we never post anything for you.
        </li>
        <li>
          <strong>Profile details you choose to add:</strong> profile picture, phone number, gender, city, bio, fitness goal and experience level.
        </li>
        <li>
          <strong>What you log:</strong> workouts, exercises and templates, walks and runs (steps, distance, duration), food and nutrition, body weight, progress photos, and
          your app settings.
        </li>
        <li>
          <strong>Gym communities:</strong> which communities you join, and the posts, comments, photos and likes you share there.
        </li>
        <li>
          <strong>Sign-in activity:</strong> when you log in, your IP address and your browser/device type, to keep accounts secure.
        </li>
      </ul>

      <H>How we use it</H>
      <ul>
        <li>To run the app: keep your log, sync it between your devices and show it back to you.</li>
        <li>Your date of birth, weight and body details are used to calculate your calorie needs.</li>
        <li>To keep accounts secure, for example by limiting repeated login attempts and spotting unusual sign-ins.</li>
      </ul>

      <H>Who can see it</H>
      <ul>
        <li>Your log, photos and body data are private to your account.</li>
        <li>In a gym community, its members can see your name, profile picture and what you post there. The gym's owners and the app's administrators can see its member list.</li>
        <li>The app's administrators can see account details and sign-in activity to manage accounts and help with problems.</li>
      </ul>

      <H>Services we rely on</H>
      <ul>
        <li>
          <strong>Hosting:</strong> the app runs on Vercel and your data is stored in a Supabase (Postgres) database. They process it only to host it for us.
        </li>
        <li>
          <strong>Google and Facebook:</strong> only if you choose to sign in with them.
        </li>
        <li>
          <strong>Open Food Facts:</strong> when you search for a food online, the search words (not who you are) are sent to Open Food Facts.
        </li>
        <li>
          <strong>OpenStreetMap:</strong> when you look for nearby gyms, your approximate location is sent through our server to OpenStreetMap's map service to find them. We
          don't store it.
        </li>
      </ul>

      <H>On your device</H>
      <p>
        The app keeps a copy of your data in your browser's storage so it works offline, plus your login. Logging out removes it from that device. We don't use advertising
        or tracking cookies.
      </p>

      <H>How long we keep it</H>
      <p>
        We keep your data while you have an account. When you ask us to delete your account, we delete it and everything in it (see{' '}
        <Link className="font-semibold link-accent" to="/data-deletion">
          Delete your data
        </Link>
        ). Sign-in activity is kept for security and is deleted along with your account.
      </p>

      <H>Your choices</H>
      <ul>
        <li>You can see and edit your profile, and change or set your password, in Settings.</li>
        <li>You can ask us for a copy of your data, to correct it, or to delete your account at any time.</li>
        <li>If you signed in with Facebook or Google, you can also remove Gymbulag's access in that service's settings.</li>
      </ul>

      <H>Children</H>
      <p>You must be at least 13 to use Gymbulag. We don't knowingly hold data about anyone younger; if you think we do, contact us and we'll delete it.</p>

      <H>Security</H>
      <p>Data is sent over encrypted connections (HTTPS). Passwords and login tokens are stored only as hashes. No system is perfectly secure, but we work to protect your data.</p>

      <H>Changes</H>
      <p>If we change this policy, we'll update this page and the date at the top.</p>

      <H>Contact</H>
      <p>
        Questions or requests about your data: <Contact />.
      </p>
    </Shell>
  );
}

function DataDeletion() {
  return (
    <Shell title="Delete your data">
      <p>You can ask us to delete your Gymbulag account and all the data in it at any time, including if you signed up with Google or Facebook.</p>

      <H>How to ask</H>
      <ul>
        <li>
          Email <Contact /> from the email address of your account, with the subject <strong>"Delete my account"</strong>.
        </li>
        <li>If you can't send from that address, tell us the account's email and we'll confirm it's you before deleting anything.</li>
      </ul>

      <H>What gets deleted</H>
      <p>
        Your account and profile, your logged workouts, walks and runs, food, weight and progress photos, your settings, your community posts, comments and likes, your
        Google/Facebook sign-in link and your sign-in history. We do this within 30 days and email you when it's done. It can't be undone.
      </p>

      <H>Remove Gymbulag from Facebook or Google</H>
      <ul>
        <li>
          <strong>Facebook:</strong> Settings &amp; privacy → Settings → Apps and websites → Gymbulag → Remove.
        </li>
        <li>
          <strong>Google:</strong> myaccount.google.com → Security → Your connections to third-party apps &amp; services → Gymbulag → Delete all connections.
        </li>
      </ul>
      <p>This stops Gymbulag from using that sign-in, but doesn't delete your Gymbulag data; email us for that.</p>

      <H>Just this device</H>
      <p>Logging out removes your data from that device. It stays in your account until you ask us to delete it.</p>
    </Shell>
  );
}

export default function LegalPage({ page }: { page: 'privacy' | 'data-deletion' }) {
  return page === 'privacy' ? <Privacy /> : <DataDeletion />;
}
