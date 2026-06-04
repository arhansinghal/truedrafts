import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How TrueDrafts collects, uses, and protects your information.",
};

const EFFECTIVE_DATE = "June 2, 2026";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="bg-gradient-to-b from-[#f8faff] to-white px-4 py-12 text-center">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Privacy Policy</h1>
          <p className="mt-3 text-sm text-gray-500">
            Effective {EFFECTIVE_DATE} · Last updated {EFFECTIVE_DATE}
          </p>
        </div>
      </section>

      <article className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-gray-600 leading-relaxed mb-8">
          TrueDrafts (&ldquo;TrueDrafts,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
          &ldquo;our&rdquo;) operates the website at truedrafts.com (the
          &ldquo;Service&rdquo;), a marketplace where students admitted to colleges
          (&ldquo;Writers&rdquo;) share and sell their college application materials, and
          where other users (&ldquo;Buyers&rdquo; or &ldquo;Readers&rdquo;) purchase access
          to those materials. This Privacy Policy explains what information we collect, how we
          use it, and the choices you have. If you have questions, contact us at{" "}
          <a href="mailto:team@truedrafts.com" className="text-[#0851A0] underline">
            team@truedrafts.com
          </a>
          .
        </p>

        <Section title="1. Information we collect">
          <p>
            <strong>Information you provide directly.</strong>
          </p>
          <ul>
            <li>
              <strong>Account information:</strong> name, email address, username, and
              password (passwords are stored only as salted hashes, never in plaintext). If
              you sign in with Google, we receive your name, email, and profile photo from
              Google.
            </li>
            <li>
              <strong>Profile information:</strong> bio, profile photo, role, and—if you
              choose to provide them—academic details such as SAT/ACT scores, GPA,
              extracurricular activities, graduation year, and &ldquo;verified admit&rdquo;
              status.
            </li>
            <li>
              <strong>Content you upload:</strong> college application essays, application
              materials, and related text you submit as a Writer.
            </li>
            <li>
              <strong>Payout information (Writers):</strong> to receive earnings, you provide
              payout details such as a UPI ID, bank account number and IFSC, or Zelle
              email/phone. Bank account numbers are encrypted at rest.
            </li>
            <li>
              <strong>Communications:</strong> messages you send us (e.g., support requests).
            </li>
          </ul>
          <p>
            <strong>Information collected automatically.</strong> An authentication cookie
            that keeps you logged in, and limited technical information such as pages viewed
            and basic device/browser information, used to operate and secure the Service.
          </p>
          <p>
            <strong>Payment information.</strong> Payments are processed by Razorpay. When you
            make a purchase, your card/UPI/banking details are submitted directly to Razorpay
            and are <strong>not</strong> stored on TrueDrafts servers. We retain only a
            payment/order reference, the amount, and the purchase status. Please review{" "}
            <a
              href="https://razorpay.com/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0851A0] underline"
            >
              Razorpay&apos;s Privacy Policy
            </a>
            .
          </p>
        </Section>

        <Section title="2. How we use your information">
          <p>We use the information we collect to:</p>
          <ul>
            <li>create and manage your account and authenticate you;</li>
            <li>
              operate the marketplace—list materials, process purchases, grant access, and
              pay Writers;
            </li>
            <li>process payments and payouts and maintain financial records;</li>
            <li>provide search and AI-assisted features (see Section 3);</li>
            <li>
              send transactional emails (purchase confirmations, payout updates, password
              resets);
            </li>
            <li>
              prevent fraud, enforce our Terms of Service, and comply with legal obligations;
            </li>
            <li>respond to your requests and improve the Service.</li>
          </ul>
        </Section>

        <Section title="3. AI and automated processing">
          <p>
            TrueDrafts uses third-party artificial-intelligence providers to power search and
            to generate insights about application materials. Content and search queries may
            be processed by these providers (which may include Anthropic, Google, and others)
            solely to deliver these features. We do not sell your content, and we instruct our
            providers to process it only on our behalf.
          </p>
        </Section>

        <Section title="4. How we share information">
          <p>We do not sell your personal information. We share it only:</p>
          <ul>
            <li>
              <strong>With service providers</strong> who help us run the Service—our payment
              processor (Razorpay), database/hosting providers, email provider, and AI
              providers—each acting under contract and only as needed to provide their
              service;
            </li>
            <li>
              <strong>Between users as part of the marketplace:</strong> a Writer&apos;s public
              profile (e.g., username, bio, verified-admit status) and listed materials are
              visible to other users. Buyers&apos; identities are not disclosed to Writers
              beyond aggregate sales information;
            </li>
            <li>
              <strong>For legal reasons:</strong> to comply with law, respond to lawful
              requests, or protect the rights, safety, and property of TrueDrafts, our users,
              or the public;
            </li>
            <li>
              <strong>In a business transfer:</strong> in connection with a sale or transfer
              of the Service or its assets, subject to this Policy.
            </li>
          </ul>
        </Section>

        <Section title="5. Data retention">
          <p>
            We retain your information for as long as your account is active and as needed to
            provide the Service, comply with legal and financial-record obligations, resolve
            disputes, and enforce our agreements. You may request deletion of your account
            (see Section 7); some records (e.g., transaction history) may be retained where
            required by law.
          </p>
        </Section>

        <Section title="6. Security">
          <p>
            We use technical and organizational measures to protect your information,
            including encryption of sensitive payout details (bank account numbers) and hashed
            passwords. No system is perfectly secure, and we cannot guarantee absolute
            security.
          </p>
        </Section>

        <Section title="7. Your rights and choices">
          <p>
            Depending on your location, you may have the right to access, correct, delete, or
            export your personal information, or to object to or restrict certain processing.
            You can update most profile information in your account settings, or contact us at{" "}
            <a href="mailto:team@truedrafts.com" className="text-[#0851A0] underline">
              team@truedrafts.com
            </a>{" "}
            to make a request. You may also delete your account.
          </p>
        </Section>

        <Section title="8. Children&apos;s and minors&apos; privacy">
          <p>
            The Service is intended for users who are at least 16 years old. Many users are
            prospective or current college applicants. We do not knowingly collect personal
            information from children under 16. If you believe a minor under 16 has provided us
            information, contact us and we will delete it.
          </p>
        </Section>

        <Section title="9. International users">
          <p>
            TrueDrafts and its service providers may process and store your information in
            countries other than your own, including India and the United States. By using the
            Service, you consent to such transfers.
          </p>
        </Section>

        <Section title="10. Changes to this Policy">
          <p>
            We may update this Policy from time to time. We will post the updated version with
            a new &ldquo;Last updated&rdquo; date, and material changes will be communicated as
            required by law.
          </p>
        </Section>

        <Section title="11. Contact us">
          <p>
            Questions about this Policy or your data:{" "}
            <a href="mailto:team@truedrafts.com" className="text-[#0851A0] underline">
              team@truedrafts.com
            </a>
            .
          </p>
        </Section>
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="space-y-3 text-gray-600 leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5 [&_strong]:text-gray-900">
        {children}
      </div>
    </section>
  );
}
