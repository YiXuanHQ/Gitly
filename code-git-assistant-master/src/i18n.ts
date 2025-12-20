import * as vscode from 'vscode';

export type SupportedLanguage = 'en' | 'zh-CN';

interface TranslationMap {
	[key: string]: string | TranslationMap;
}

const translations: Record<SupportedLanguage, TranslationMap> = {
	'en': {
		'statusBar.text': 'Git Graph',
		'statusBar.tooltip': 'View Git Graph',
		'sidebar.noRepos': 'No Git repositories found',
		'sidebar.branches.local': 'Local Branches',
		'sidebar.branches.remote': 'Remote Branches',
		'sidebar.branches.noLocal': 'No local branches',
		'sidebar.branches.noRemote': 'No remote branches',
		'sidebar.branches.current': 'current',
		'sidebar.branches.checkout': 'Checkout Branch',
		'sidebar.history.noCommits': 'No commits found',
		'sidebar.history.unableToLoad': 'Unable to load history',
		'sidebar.history.openGraph': 'Open Git Graph',
		'sidebar.conflicts.noConflicts': 'No conflicts',
		'sidebar.conflicts.conflict': 'Conflict',
		'sidebar.conflicts.conflictFile': 'Conflict file',
		'sidebar.conflicts.unableToLoad': 'Unable to load uncommitted changes',
		'sidebar.conflicts.openFile': 'Open File'
	},
	'zh-CN': {
		'statusBar.text': 'Git 图形',
		'statusBar.tooltip': '查看 Git 图形',
		'sidebar.noRepos': '未找到 Git 仓库',
		'sidebar.branches.local': '本地分支',
		'sidebar.branches.remote': '远程分支',
		'sidebar.branches.noLocal': '没有本地分支',
		'sidebar.branches.noRemote': '没有远程分支',
		'sidebar.branches.current': '当前',
		'sidebar.branches.checkout': '切换分支',
		'sidebar.history.noCommits': '未找到提交',
		'sidebar.history.unableToLoad': '无法加载历史记录',
		'sidebar.history.openGraph': '打开 Git 图形视图',
		'sidebar.conflicts.noConflicts': '当前没有冲突',
		'sidebar.conflicts.conflict': '冲突',
		'sidebar.conflicts.conflictFile': '冲突文件',
		'sidebar.conflicts.unableToLoad': '无法加载未提交的更改',
		'sidebar.conflicts.openFile': '打开文件'
	}
};

/**
 * Get the current language setting from configuration
 */
function getLanguage(): SupportedLanguage {
	const vscodeLanguage = vscode.env.language;
	const normalised = vscodeLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
	return normalised as SupportedLanguage;
}

/**
 * Get a translated string by key
 * @param key Translation key (supports nested keys with dot notation, e.g., 'sidebar.branches.local')
 * @param params Optional parameters for string interpolation
 * @returns Translated string
 */
export function t(key: string, ...params: any[]): string {
	const language = getLanguage();
	const translation = translations[language] || translations['en'];

	// 直接按完整 key 查表（例如 'sidebar.branches.local'），并回退到英文
	let value: any =
		(translation && (translation as any)[key]) ??
		(translations['en'] as any)[key];

	if (typeof value !== 'string') {
		return key;
	}

	// 简单的 %s 占位符替换
	if (params.length > 0) {
		let result = value;
		params.forEach((param, index) => {
			result = result.replace(`%s${index + 1}`, String(param));
		});
		return result;
	}

	return value;
}

/**
 * Get the current language code
 */
export function getCurrentLanguage(): SupportedLanguage {
	return getLanguage();
}

/**
 * Get web view translations based on language
 */
export function getWebTranslations(language: string): Record<string, string> {
	const lang = (language === 'zh-CN' ? 'zh-CN' : 'en') as SupportedLanguage;
	return {
		columnGraph: lang === 'zh-CN' ? '图形' : 'Graph',
		columnDescription: lang === 'zh-CN' ? '描述' : 'Description',
		columnDate: lang === 'zh-CN' ? '日期' : 'Date',
		columnAuthor: lang === 'zh-CN' ? '作者' : 'Author',
		columnCommit: lang === 'zh-CN' ? '提交' : 'Commit',
		dropdownRepos: lang === 'zh-CN' ? '仓库' : 'Repos',
		dropdownBranches: lang === 'zh-CN' ? '分支' : 'Branches',
		dropdownShowAll: lang === 'zh-CN' ? '显示全部' : 'Show All',
		checkboxShowRemoteBranches: lang === 'zh-CN' ? '显示远程分支' : 'Show Remote Branches',
		buttonLoadMoreCommits: lang === 'zh-CN' ? '加载更多提交' : 'Load More Commits',
		buttonFetch: lang === 'zh-CN' ? '获取' : 'Fetch',
		buttonRefresh: lang === 'zh-CN' ? '刷新' : 'Refresh',
		buttonSearch: lang === 'zh-CN' ? '搜索' : 'Search',
		buttonSettings: lang === 'zh-CN' ? '设置' : 'Settings',
		labelRepo: lang === 'zh-CN' ? '仓库: ' : 'Repo: ',
		labelBranches: lang === 'zh-CN' ? '分支: ' : 'Branches: '
	};
}

