import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-dark-primary">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-brand-accent">RIVERZ</h1>
          <p className="mt-2 text-gray-400">Inicia sesión en tu cuenta</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              formButtonPrimary: 'bg-brand-accent hover:bg-brand-accent/90',
              card: 'bg-brand-dark-secondary border border-gray-700',
              headerTitle: 'text-white',
              headerSubtitle: 'text-gray-400',
              socialButtonsBlockButton: 'bg-brand-dark-primary border-gray-700 hover:bg-gray-800',
              formFieldLabel: 'text-white',
              formFieldInput: 'bg-brand-dark-primary border-gray-700 text-white',
              footerActionLink: 'text-brand-accent hover:text-brand-accent/90',
            },
          }}
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          afterSignInUrl="/crear"
          afterSignUpUrl="/crear"
        />
      </div>
    </div>
  );
}

