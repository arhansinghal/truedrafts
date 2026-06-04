import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms governing your use of TrueDrafts.",
};

const EFFECTIVE_DATE = "June 2, 2026";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="bg-gradient-to-b from-[#f8faff] to-white px-4 py-12 text-center">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Terms of Service</h1>
          <p className="mt-3 text-sm text-gray-500">
            Effective {EFFECTIVE_DATE} · Last updated {EFFECTIVE_DATE}
          </p>
        </div>
      </section>

      <article className="mx-auto max-w-3xl px-4 py-12">
        <Section title="1. Agreement to terms">
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) are a binding agreement between you
            and TrueDrafts (&ldquo;TrueDrafts,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;)
            governing your use of truedrafts.com and related services (the
            &ldquo;Service&rdquo;). By creating an account or using the Service, you agree to
            these Terms and to our{" "}
            <a href="/privacy" className="text-[#0851A0] underline">
              Privacy Policy
            </a>
            . If you do not agree, do not use the Service.
          </p>
        </Section>

        <Section title="2. Eligibility">
          <p>
            You must be at least 16 years old to use the Service and have the legal capacity to
            enter into these Terms. If you are under the age of majority in your jurisdiction,
            you represent that you have permission from a parent or legal guardian.
          </p>
        </Section>

        <Section title="3. Accounts">
          <p>
            You are responsible for the accuracy of your account information and for keeping
            your password secure. You are responsible for all activity under your account.
            Notify us immediately of any unauthorized use. You may not share, sell, or transfer
            your account.
          </p>
        </Section>

        <Section title="4. The marketplace — how it works">
          <p>
            TrueDrafts is a platform that connects Writers (users who upload college
            application materials) with Buyers (users who purchase access to those materials).
            TrueDrafts is a marketplace and intermediary; we do not author the materials and
            are not a party to the underlying relationship between Writers and Buyers except as
            expressly stated here.
          </p>
        </Section>

        <Section title="5. Academic integrity — important">
          <p>
            TrueDrafts materials are provided for reference, inspiration, and educational
            purposes only. You agree that you will <strong>not</strong>:
          </p>
          <ul>
            <li>
              submit any purchased or accessed material, in whole or in part, as your own work
              to any college, university, scholarship, employer, or other institution;
            </li>
            <li>
              plagiarize, copy, or misrepresent another person&apos;s application materials as
              your own.
            </li>
          </ul>
          <p>
            You are solely responsible for complying with the academic-integrity and admissions
            policies of any institution to which you apply. TrueDrafts does not condone
            academic dishonesty and is not responsible for how Buyers use purchased materials.
            Violations may result in immediate termination of your account.
          </p>
        </Section>

        <Section title="6. Writer terms">
          <p>If you upload materials as a Writer, you represent and warrant that:</p>
          <ul>
            <li>
              the materials are your own original work and you own or control all rights
              necessary to upload and sell them;
            </li>
            <li>
              the materials do not infringe any third party&apos;s intellectual-property,
              privacy, or other rights, and do not contain another person&apos;s confidential or
              personal information without consent;
            </li>
            <li>any &ldquo;verified admit&rdquo; or academic claims you make are true.</li>
          </ul>
          <p>
            <strong>License you grant us.</strong> You grant TrueDrafts a non-exclusive,
            worldwide, royalty-free license to host, display, reproduce, excerpt (e.g.,
            previews), and distribute your materials to operate and promote the Service and to
            deliver purchased access to Buyers. You retain ownership of your materials. This
            license continues for materials that have been sold, so that Buyers retain the
            access they paid for, and otherwise ends when you remove the material or close your
            account.
          </p>
          <p>
            <strong>Earnings &amp; payouts.</strong> Writers earn a share of the sale price as
            published in the Service, with the remainder retained by TrueDrafts as a platform
            fee. Earnings accrue to your balance and may
            be withdrawn once you meet the minimum payout threshold and provide valid payout
            details. Payouts are made manually to the method you provide (e.g., UPI, bank
            account, or Zelle). You are responsible for the accuracy of your payout details and
            for any taxes on your earnings.
          </p>
        </Section>

        <Section title="7. Buyer terms">
          <p>
            When you purchase access to material, you receive a limited, personal,
            non-exclusive, non-transferable license to view it for your own reference, subject
            to Section 5. You may not redistribute, resell, publish, or share purchased
            materials.
          </p>
          <p>
            <strong>Payments.</strong> Prices are shown at checkout and processed by Razorpay.
            By purchasing, you authorize the charge and agree to Razorpay&apos;s terms.
          </p>
          <p>
            <strong>Refunds.</strong> Because purchases grant immediate access to digital
            content, all sales are final and purchases are generally non-refundable. TrueDrafts
            may, at its sole discretion, issue a refund in exceptional circumstances (for
            example, a technical error or duplicate charge). There is no customer self-service
            refund process.
          </p>
        </Section>

        <Section title="8. Prohibited conduct">
          <p>You agree not to:</p>
          <ul>
            <li>
              violate any law or the academic-integrity rules of any institution;
            </li>
            <li>
              upload material you do not own or that is false, infringing, defamatory, or
              contains others&apos; personal data without consent;
            </li>
            <li>
              attempt to circumvent payment, scrape the Service, or access materials you have
              not purchased;
            </li>
            <li>
              interfere with or disrupt the Service, or attempt to gain unauthorized access;
            </li>
            <li>impersonate others or misrepresent your admissions outcomes.</li>
          </ul>
        </Section>

        <Section title="9. Intellectual property">
          <p>
            The Service itself—including its software, design, logos, and content created by
            TrueDrafts—is owned by TrueDrafts and protected by intellectual-property laws.
            These Terms do not grant you any rights in our trademarks or branding.
          </p>
        </Section>

        <Section title="10. Content moderation and termination">
          <p>
            We may review, remove, or refuse any material, and may suspend or terminate
            accounts that violate these Terms, at our discretion. You may stop using the
            Service and delete your account at any time. Sections that by their nature should
            survive termination (e.g., Sections 5, 6, 9, 11–14) will survive.
          </p>
        </Section>

        <Section title="11. Disclaimers">
          <p>
            The Service and all materials are provided &ldquo;as is&rdquo; and &ldquo;as
            available,&rdquo; without warranties of any kind, express or implied, including
            merchantability, fitness for a particular purpose, and non-infringement. TrueDrafts
            does not warrant that materials are accurate, original, error-free, or that using
            the Service will result in any particular admissions or academic outcome. We do not
            endorse or guarantee any Writer&apos;s claims.
          </p>
        </Section>

        <Section title="12. Limitation of liability">
          <p>
            To the maximum extent permitted by law, TrueDrafts and its operators will not be
            liable for any indirect, incidental, special, consequential, or punitive damages,
            or for any loss of profits, data, or goodwill, arising from your use of the
            Service. Our total liability for any claim relating to the Service will not exceed
            the greater of (a) the amount you paid to TrueDrafts in the 12 months before the
            claim, or (b) INR 5,000.
          </p>
        </Section>

        <Section title="13. Indemnification">
          <p>
            You agree to indemnify and hold harmless TrueDrafts and its operators from any
            claims, damages, or expenses (including reasonable legal fees) arising from your
            content, your use of the Service, or your violation of these Terms or any law or
            third-party right—including any claim that material you uploaded infringes
            someone&apos;s rights or that material you used violated an institution&apos;s
            policies.
          </p>
        </Section>

        <Section title="14. Governing law and disputes">
          <p>
            These Terms are governed by the laws of India, without regard to conflict-of-laws
            rules. You agree to the exclusive jurisdiction of the courts located in India for
            any disputes, except where prohibited by law.
          </p>
        </Section>

        <Section title="15. Changes to these Terms">
          <p>
            We may modify these Terms from time to time. We will post the updated Terms with a
            new &ldquo;Last updated&rdquo; date; material changes will be communicated as
            required. Continued use after changes take effect constitutes acceptance.
          </p>
        </Section>

        <Section title="16. Contact">
          <p>
            Questions about these Terms:{" "}
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
