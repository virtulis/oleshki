import { Maybe } from '../util.js';
import { FormEventHandler, useState } from 'react';
import { t } from './i18n.js';

export interface AuthState {
	user?: Maybe<string>;
	password?: Maybe<string>;
	valid?: Maybe<boolean>;
}

export function AuthForm({ state, onChange }: { state: AuthState; onChange: (state: AuthState) => void }) {
	
	const [user, setUser] = useState(state.user ?? '');
	const [password, setPassword] = useState('');
	const [valid, setValid] = useState(!!state.valid);
	
	const submit: FormEventHandler = async (e) => {
	
		e.preventDefault();
		
		const res = await fetch('data/updated.txt', {
			headers: {
				Authorization: `Basic ${btoa(`${user.trim()}:${password.trim()}`)}`,
			},
		});
		
		if (res.ok) return onChange({
			user: user.trim(),
			password: password.trim(),
			valid: true,
		});
		
		if (res.status == 401) return alert(t('Неверный логин или пароль'));
		
		alert(res.statusText);
		
	};
	
	return <form method="post" className="auth" onSubmit={submit}>
		<div>
			<span>{valid ? `✔️ ${t('есть доступ')}` : `✖️ ${t('нет доступа')}`}.</span>{' '}
			{valid && <a onClick={() => onChange({})}>{t('сбросить')}</a>}
		</div>
		<label>
			{t('Пользователь')}
			<input
				name="username"
				autoComplete="username"
				value={user}
				onChange={e => setUser(e.currentTarget.value)}
			/>
		</label>
		<label>
			{t('Пароль')}
			<input
				type="password"
				name="password"
				autoComplete="password"
				value={password}
				onChange={e => setPassword(e.currentTarget.value)}
			/>
		</label>
		<button type="submit">{t('Войти')}</button>
	</form>;
	
}
