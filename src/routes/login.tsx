import { useSearchParams } from '@solidjs/router';
import SimpleLayout from '~/components/SimpleLayout';
export default function Login() {
  const [params] = useSearchParams();
  return <SimpleLayout><main class="mx-auto max-w-lg px-6 py-12 text-white">
    <h1 class="mb-4 text-2xl">Sign in to ysocial</h1>
    {params.error && <p role="alert" class="mb-4">Sign-in could not be completed. Your login may have expired, or CNS may be unavailable. Please try again.</p>}
    <a class="inline-block rounded bg-white px-4 py-2 text-black" href="/auth/login" rel="external">Sign in with CNS</a>
    <p class="mt-4 text-neutral-400">CNS handles your password and account security.</p>
    <a href="/" class="mt-6 inline-block underline">Continue browsing</a>
  </main></SimpleLayout>;
}
