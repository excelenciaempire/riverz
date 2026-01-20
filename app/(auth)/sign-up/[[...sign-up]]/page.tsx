import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#000000]">
      <div className="w-full max-w-sm px-4">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-[#07A498] tracking-wider">RIVERZ</h1>
          <p className="mt-2 text-sm text-gray-500">Crea tu cuenta</p>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'bg-transparent shadow-none border-none p-0',
              headerTitle: 'hidden',
              headerSubtitle: 'hidden',
              socialButtonsBlockButton: 'hidden',
              socialButtonsPlacement: 'hidden',
              dividerRow: 'hidden',
              formFieldLabel: 'text-gray-400 text-xs uppercase tracking-wide font-medium ml-1 mb-1.5',
              formFieldInput: 'bg-[#0a0a0a] border border-gray-800 text-white rounded-xl px-4 py-3 focus:border-[#07A498] focus:ring-1 focus:ring-[#07A498] transition-all outline-none',
              formButtonPrimary: 'bg-[#07A498] hover:bg-[#068f84] text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-[#07A498]/20 mt-4',
              footerActionLink: 'text-[#07A498] hover:text-[#068f84] font-medium text-sm',
              footerActionText: 'text-gray-500 text-sm',
              identityPreviewText: 'text-gray-300',
              identityPreviewEditButton: 'text-[#07A498] ml-2',
              formFieldInputShowPasswordButton: 'text-gray-500 hover:text-white',
              otpCodeFieldInput: 'bg-[#0a0a0a] border-gray-800 text-white rounded-lg',
              formResendCodeLink: 'text-[#07A498] hover:text-[#068f84]',
              errorMessage: 'text-red-500 text-sm mt-2',
            },
            layout: {
              socialButtonsPlacement: 'bottom',
              showOptionalFields: false,
            },
          }}
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          afterSignUpUrl="/crear"
        />
      </div>
    </div>
  );
}

