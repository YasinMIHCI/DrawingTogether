<script lang="ts">
  import { auth, AuthFailure, changePassword, changeRecovery, recoveryQuestion, removeAvatar, resetPassword, signIn, signOut, signUp, updateProfile, uploadAvatar } from '../social/auth.svelte';
  import { MIN_PASSWORD } from '../social/username';
  import { pickFile } from '../lib/download';
  import { settings } from '../lib/settings.svelte';
  import { t } from '../lib/i18n/t.svelte';
  import type { Key } from '../lib/i18n/i18n.svelte';
  import Avatar from '../components/Avatar.svelte';
  import AvatarEditor from '../ui/social/AvatarEditor.svelte';

  type Tab = 'signin' | 'signup' | 'forgot';
  let tab = $state<Tab>('signin');
  let username = $state('');
  let password = $state('');
  let password2 = $state('');
  const questions: Key[] = ['acc.q1', 'acc.q2', 'acc.q3'];
  let questionChoice = $state<string>('acc.q1');
  let ownQuestion = $state('');
  let answer = $state('');
  let error = $state<string | null>(null);
  let info = $state<string | null>(null);
  let busy = $state(false);
  // Mot de passe oublié
  let forgotQuestion = $state<string | null>(null);
  // Profil
  let displayName = $state('');
  let bio = $state('');
  let avatarMode = $state<'crop' | 'draw' | null>(null);
  let avatarFile = $state<File | null>(null);

  $effect(() => {
    if (auth.profile) {
      displayName = auth.profile.display_name;
      bio = auth.profile.bio;
    }
  });

  const question = $derived(questionChoice === 'own' ? ownQuestion : t(questionChoice as Key));

  async function run(f: () => Promise<void>, ok?: string) {
    busy = true;
    error = null;
    info = null;
    try {
      await f();
      if (ok) info = ok;
    } catch (e) {
      error = t(`acc.err.${e instanceof AuthFailure ? e.code : 'network'}` as Key);
    }
    busy = false;
  }

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (tab === 'signin') run(() => signIn(username, password));
    else if (tab === 'signup') {
      if (password !== password2) return (error = t('acc.mismatch'));
      run(async () => {
        await signUp(username, password, question, answer);
        location.hash = '#/bouille/new';
      });
    } else if (!forgotQuestion) {
      run(async () => {
        forgotQuestion = await recoveryQuestion(username);
      });
    } else {
      run(async () => {
        await resetPassword(username, answer, password);
        tab = 'signin';
        forgotQuestion = null;
        answer = '';
        password = '';
      }, t('acc.resetDone'));
    }
  }

  async function importPhoto() {
    const f = await pickFile('image/*');
    if (f) {
      avatarFile = f;
      avatarMode = 'crop';
    }
  }
  function saveAvatar(png: Blob) {
    avatarMode = null;
    run(() => uploadAvatar(png), t('acc.saved'));
  }
  let newPw = $state('');
  let secQuestion = $state('');
  let secAnswer = $state('');
</script>

<main>
  <h1 class="band">{t('acc.title')}</h1>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if info}<p class="info" role="status">{info}</p>{/if}

  {#if !auth.ready}
    <p class="muted">…</p>
  {:else if !auth.profile}
    <p class="muted">{t('acc.optional')}</p>
    <div class="tabs" role="tablist">
      {#each ['signin', 'signup', 'forgot'] as const as tb (tb)}
        <button role="tab" aria-selected={tab === tb} onclick={() => ((tab = tb), (error = null), (forgotQuestion = null))}>{t(`acc.${tb}`)}</button>
      {/each}
    </div>
    <form class="card" onsubmit={submit}>
      <label class="field"><span>{t('acc.username')}</span>
        <input type="text" bind:value={username} autocomplete="username" autocapitalize="none" spellcheck="false" required disabled={!!forgotQuestion} />
        {#if tab === 'signup'}<small>{t('acc.usernameHint')}</small>{/if}</label>
      {#if tab !== 'forgot' || forgotQuestion}
        {#if tab === 'forgot'}
          <p class="q"><b>{t('acc.question')} :</b> {forgotQuestion}</p>
          <label class="field"><span>{t('acc.answer')}</span><input type="text" bind:value={answer} autocomplete="off" required /></label>
        {/if}
        <label class="field"><span>{tab === 'forgot' ? t('acc.newPassword') : t('acc.password')}</span>
          <input type="password" bind:value={password} autocomplete={tab === 'signin' ? 'current-password' : 'new-password'} required minlength={tab === 'signin' ? 1 : MIN_PASSWORD} />
          {#if tab !== 'signin'}<small>{t('acc.passwordHint')}</small>{/if}</label>
      {/if}
      {#if tab === 'signup'}
        <label class="field"><span>{t('acc.password2')}</span><input type="password" bind:value={password2} autocomplete="new-password" required /></label>
        <fieldset>
          <legend>{t('acc.question')}</legend>
          <small>{t('acc.questionHint')}</small>
          <select bind:value={questionChoice}>
            {#each questions as q (q)}<option value={q}>{t(q)}</option>{/each}
            <option value="own">{t('acc.q4')}</option>
          </select>
          {#if questionChoice === 'own'}<input type="text" bind:value={ownQuestion} placeholder={t('acc.ownQuestion')} maxlength="200" />{/if}
          <label class="field"><span>{t('acc.answer')}</span><input type="text" bind:value={answer} autocomplete="off" required /><small>{t('acc.answerHint')}</small></label>
        </fieldset>
      {/if}
      <button class="btn primary" disabled={busy}>
        {tab === 'signin' ? t('acc.signin') : tab === 'signup' ? t('acc.signup') : forgotQuestion ? t('acc.reset') : t('acc.next')}
      </button>
    </form>
  {:else}
    <section class="card">
      <p class="muted">{t('acc.loggedAs', { name: auth.profile.username })}</p>
      <h2>{t('acc.avatar')}</h2>
      <div class="avatar-row">
        <Avatar id={settings.avatar} url={auth.profile.avatar_url} size={96} />
        <div class="col">
          <a class="btn primary" href="#/bouille">{settings.bouille ? t('bou.edit') : t('bou.create')}</a>
          <button class="btn" onclick={importPhoto}>{t('acc.importPhoto')}</button>
          <button class="btn" onclick={() => (avatarMode = 'draw')}>{t('acc.drawAvatar')}</button>
          {#if auth.profile.avatar_url}<button class="btn ghost" onclick={() => run(removeAvatar)}>{t('acc.removeAvatar')}</button>{/if}
        </div>
      </div>
    </section>
    <form class="card" onsubmit={(e) => { e.preventDefault(); run(() => updateProfile({ display_name: displayName.trim().slice(0, 40), bio: bio.slice(0, 280) }), t('acc.saved')); }}>
      <h2>{t('acc.profile')}</h2>
      <label class="field"><span>{t('acc.displayName')}</span><input type="text" bind:value={displayName} maxlength="40" /></label>
      <label class="field"><span>{t('acc.bio')}</span><textarea bind:value={bio} maxlength="280" rows="3"></textarea></label>
      <button class="btn primary" disabled={busy}>{t('acc.save')}</button>
    </form>
    <section class="card">
      <h2>{t('acc.security')}</h2>
      <form class="inline" onsubmit={(e) => { e.preventDefault(); run(() => changePassword(newPw), t('acc.saved')).then(() => (newPw = '')); }}>
        <input type="password" bind:value={newPw} placeholder={t('acc.newPassword')} autocomplete="new-password" minlength={MIN_PASSWORD} required />
        <button class="btn">{t('acc.changePassword')}</button>
      </form>
      <form class="inline" onsubmit={(e) => { e.preventDefault(); run(() => changeRecovery(secQuestion, secAnswer), t('acc.saved')).then(() => ((secQuestion = ''), (secAnswer = ''))); }}>
        <input type="text" bind:value={secQuestion} placeholder={t('acc.question')} maxlength="200" required />
        <input type="text" bind:value={secAnswer} placeholder={t('acc.answer')} required />
        <button class="btn">{t('acc.changeQuestion')}</button>
      </form>
      <button class="btn danger" onclick={() => run(signOut)}>{t('acc.signout')}</button>
    </section>
  {/if}
</main>

{#if avatarMode}
  <AvatarEditor mode={avatarMode} file={avatarFile} onsave={saveAvatar} oncancel={() => (avatarMode = null)} />
{/if}

<style>
  main { max-width: 620px; margin: 0 auto; padding: 8px 16px 40px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
  h1, h2 { margin: 0; }
  h2 { font-size: 1.1rem; }
  .muted { margin: 0; color: var(--ink-soft); }
  .error { margin: 0; padding: 10px 14px; border-radius: 12px; background: #ffe1dc; color: #8a1f0e; }
  .info { margin: 0; padding: 10px 14px; border-radius: 12px; background: #dff5ef; color: #0f5b4f; }
  .tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .tabs button { font: inherit; font-weight: 700; padding: 10px 6px; border-radius: 12px; border: 2px solid var(--line); background: var(--surface-2); color: var(--ink-soft); cursor: pointer; }
  .tabs [aria-selected='true'] { background: var(--surface); color: var(--ink); border-color: var(--accent); }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; box-shadow: var(--shadow); display: grid; gap: 12px; }
  .field { display: grid; gap: 4px; }
  .field span, legend { font-weight: 600; font-size: 0.9rem; color: var(--ink-soft); }
  small { color: var(--ink-soft); font-size: 0.8rem; }
  input, select, textarea { font: inherit; color: var(--ink); padding: 10px 12px; border: 2px solid var(--line); border-radius: 12px; background: var(--surface-2); min-width: 0; }
  fieldset { border: 0; padding: 0; margin: 0; display: grid; gap: 8px; }
  .q { margin: 0; }
  .btn { font: inherit; min-height: 44px; padding: 0 16px; border-radius: 12px; border: 2px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; }
  a.btn { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); font-weight: 700; }
  .btn.ghost { background: none; }
  .btn.danger { color: var(--danger); justify-self: start; }
  .btn:disabled { opacity: 0.5; }
  .avatar-row { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
  .col { display: grid; gap: 6px; }
  .inline { display: flex; gap: 8px; flex-wrap: wrap; }
  .inline input { flex: 1; min-width: 160px; }
</style>
