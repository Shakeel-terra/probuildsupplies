// pbs-account.js
// Shared customer-account helper, loaded on every page (alongside
// pbs-products.js). Wraps Supabase Auth for customer sign up / sign in /
// order history, and fixes up the site-wide "My Account" header button.
//
// Requires the Supabase JS SDK to be loaded first:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
(function () {
  'use strict';

  var SUPA_URL = 'https://kiifrcsqsxlumteoyenf.supabase.co';
  var SUPA_KEY = 'sb_publishable_cgEIv028aTATK1dKiv-q1A_NIc6WmaP';

  if (typeof supabase === 'undefined' || !supabase.createClient) {
    console.error('pbs-account.js: Supabase SDK not loaded — add the supabase-js <script> tag before this file.');
    return;
  }

  var sb = supabase.createClient(SUPA_URL, SUPA_KEY);

  function pathPrefix() {
    var path = window.location.pathname;
    return (path.indexOf('/products/') !== -1 || path.indexOf('/blog/') !== -1) ? '../' : '';
  }

  async function getSession() {
    var res = await sb.auth.getSession();
    return (res.data && res.data.session) || null;
  }

  async function getUser() {
    var session = await getSession();
    return session ? session.user : null;
  }

  function signUp(email, password) {
    return sb.auth.signUp({
      email: email,
      password: password,
      options: {
        emailRedirectTo: window.location.origin + pathPrefix() + 'account.html',
      },
    });
  }

  function signIn(email, password) {
    return sb.auth.signInWithPassword({ email: email, password: password });
  }

  function signOut() {
    return sb.auth.signOut();
  }

  function resetPassword(email) {
    return sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + pathPrefix() + 'account.html#recovery',
    });
  }

  function updatePassword(newPassword) {
    return sb.auth.updateUser({ password: newPassword });
  }

  // Links any past guest checkouts (made before this account existed) to
  // this account, matching on the verified login email server-side.
  function claimMyOrders() {
    return sb.rpc('claim_my_orders');
  }

  async function fetchMyOrders() {
    var user = await getUser();
    if (!user) return { data: [], error: null };
    return sb
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
  }

  // ── Fix up the header "My Account" button on every page ─────────
  async function refreshAccountButton() {
    var btn = document.querySelector('.pbs-account-btn');
    if (!btn) return;
    var fp = pathPrefix();
    btn.setAttribute('href', fp + 'account.html');
    // Was previously wired to Snipcart's own modal — no longer used
    // now checkout runs through Stripe, so make sure that's gone.
    btn.classList.remove('snipcart-customer-signin');

    var user = await getUser();
    if (user) {
      var label = user.email ? user.email.split('@')[0] : 'Account';
      btn.textContent = '👤 ' + label;
    } else {
      btn.textContent = '👤 My Account';
    }
  }

  document.addEventListener('DOMContentLoaded', refreshAccountButton);
  sb.auth.onAuthStateChange(function () { refreshAccountButton(); });

  window.pbsAccount = {
    sb: sb,
    getSession: getSession,
    getUser: getUser,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    resetPassword: resetPassword,
    updatePassword: updatePassword,
    claimMyOrders: claimMyOrders,
    fetchMyOrders: fetchMyOrders,
  };
})();
