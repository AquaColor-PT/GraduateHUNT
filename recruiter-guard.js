// recruiter-guard.js
// Put this on every recruiter-only page (e.g. recruiters-buycredits.html).
//
// Usage on a page:
//   <script type="module">
//     import { supabase, requireVerifiedRecruiter } from './recruiter-guard.js';
//     const auth = await requireVerifiedRecruiter();
//     if (auth) {
//       // auth.user and auth.recruiter are available here.
//       // Use this same `supabase` client for the rest of the page.
//     }
//   </script>
//
// Import `supabase` from here instead of calling createClient again on the page.
// Two clients on one page can fight over the same login session.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function requireVerifiedRecruiter(loginPage = 'recruiter-login.html') {
  // Hide the page until we know the visitor is allowed to see it
  document.documentElement.style.visibility = 'hidden';

  const deny = async () => {
    await supabase.auth.signOut();
    window.location.replace(loginPage);
    return null;
  };

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.replace(loginPage);
    return null;
  }

  const { data: recruiter, error } = await supabase
    .from('recruiters')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error || !recruiter || !recruiter.verified) return deny();

  document.documentElement.style.visibility = '';
  return { user: session.user, recruiter };
}
