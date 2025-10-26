import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#000000]">
      <div className="w-full max-w-md px-4">
        <div className="mb-12 text-center">
          <h1 className="text-6xl font-bold text-[#07A498] tracking-wider">RIVERZ</h1>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'bg-[#0a0a0a] border border-gray-800 shadow-2xl rounded-2xl',
              headerTitle: 'text-white text-2xl font-semibold',
              headerSubtitle: 'text-gray-400 text-sm',
              socialButtonsBlockButton: 'bg-transparent border border-gray-700 text-white hover:bg-gray-900 transition-colors',
              socialButtonsBlockButtonText: 'text-white font-normal',
              dividerLine: 'bg-gray-800',
              dividerText: 'text-gray-500',
              formFieldLabel: 'text-white text-sm font-medium',
              formFieldInput: 'bg-transparent border border-gray-700 text-white rounded-lg focus:border-[#07A498] focus:ring-1 focus:ring-[#07A498] transition-colors',
              formButtonPrimary: 'bg-[#07A498] hover:bg-[#068f84] text-white font-semibold rounded-lg transition-colors shadow-lg',
              footerActionLink: 'text-[#07A498] hover:text-[#068f84] font-medium',
              footerActionText: 'text-gray-400',
              identityPreviewText: 'text-white',
              identityPreviewEditButton: 'text-[#07A498]',
              formFieldInputShowPasswordButton: 'text-gray-400 hover:text-white',
              otpCodeFieldInput: 'border-gray-700 text-white',
              formResendCodeLink: 'text-[#07A498] hover:text-[#068f84]',
            },
            layout: {
              socialButtonsPlacement: 'bottom',
              socialButtonsVariant: 'blockButton',
            },
          }}
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          afterSignInUrl="/crear"
        />
      </div>
    </div>
  );
}

