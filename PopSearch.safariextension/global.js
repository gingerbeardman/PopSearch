function Engine(name,keyword,url) {
	this.name    = name    || '';
	this.keyword = keyword || '';
	this.url     = url     || '';
}
function HostPrefs(hostname,lastEngine) {
	this.hostname = hostname;
	this.lastEngine = lastEngine;
}
function addEngine(name,keyword,url) {
	var engines = JSON.parse(localStorage.engines);
	engines[engines.length] = new Engine(name,keyword,url);
	localStorage.engines = JSON.stringify(engines);
}
function convertEngines() {
	localStorage.engines = JSON.stringify(se.settings.engines);
	delete se.settings.engines;
}
function convertStyles() {
	localStorage.styles = JSON.stringify(se.settings.styles);
	delete se.settings.styles;
}
function doSearch(args) {
	var thisWin = sa.activeBrowserWindow;
	var thisTab = thisWin.activeTab;
	var srcHost = /^https?/.test(thisTab.url) ? new RegExp('//([^/]+)/').exec(thisTab.url)[1] : null;
	var urlTemplate = JSON.parse(localStorage.engines)[args.eidx].url;
	if (urlTemplate.indexOf('javascript:') == 0) {
		thisTab.page.dispatchMessage('loadUrl', urlTemplate);
		console.log(urlTemplate);
	} else {
		var input = se.settings.encodeQuery ? encodeURIComponent(args.input) : escape(args.input).replace('+','%2B');
		var url = urlTemplate.replace('%s', input);
		url = url.replace('%h', srcHost);
		url = url.replace('%u', encodeURIComponent(thisTab.url));
		console.log(url);
	}
	if (args.target) {
		args.target.url = url;
	} else {
		var tarBits = se.settings.targetBits;
		var allTabs = thisWin.tabs;
		var ttIndex = allTabs.indexOf(thisTab);
		var ntToggl = (mac) ? args.mk : args.ck;
		var niToggl = (mac) ? args.ck : args.mk;
		var ntIndex = (tarBits.ta ^ niToggl) ? ttIndex + tarBits.tp : allTabs.length;
		var ntFocus = !(tarBits.tb ^ args.sk);
		var newTabForSelection = !!self.textSelection && tarBits.sn;
		var thisTabIsBlank = (thisTab.url == '' || thisTab.url == 'about:blank');
		if (((tarBits.nt && !thisTabIsBlank) || newTabForSelection) ^ ntToggl) {
			if (tarBits.uw ^ args.ok) {
				sa.openBrowserWindow().activeTab.url = url;
			} else {
				if (!ntFocus) thisTab.page.dispatchMessage('focusYourself');
				// the above line is to work around a bug in Safari 5.0.x where the
				// document does not get focus after removing the search box iframe
				var newTab = thisWin.openTab('background', ntIndex);
				newTab.url = url;
				if (ntFocus) newTab.activate();
			}
		} else {
			thisTab.url = url;
		}
	}
	self.textSelection = '';
	switch (se.settings.engineDefault) {
		case 1:
			se.settings.lastEngine = args.eidx; break;
		case 2:
			saveTopHostPref(srcHost, args.eidx); break;
	}
	if (se.settings.saveHistory) {
		saveHistoryItem(args.input);
	}
}
function doXHR(url, responseHandler) {
	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = responseHandler || function () {
		if (this.readyState === 4) {
			xhrResponseXML = this.responseXML;
			console.log(xhrResponseXML);
		}
	};
	xhr.open('GET', url, true);
	xhr.send(null);
}
function getDefaultEngine() {
	switch (se.settings.engineDefault) {
		case 0:
			return se.settings.defaultEngine;
		case 1:
			return se.settings.lastEngine;
		case 2:
			if (!/^https?/.test(event.target.url))
				return se.settings.defaultEngine;
			var topHostPrefs = se.settings.topHostPrefs;
			var targetHostname = new RegExp('//([^/]+)/').exec(event.target.url)[1];
			for (var i = 0; i < topHostPrefs.length; i++) {
				if (targetHostname === topHostPrefs[i].hostname) {
					return topHostPrefs[i].lastEngine;
				}
			}
			return se.settings.defaultEngine;
		default: return se.settings.defaultEngine;
	}
}
function getHistoryMatches(substring) {
	var matches = [];
	var history = se.settings.history;
	for (var i = 0; i < history.length; i++) {
		if (history[i].indexOf(substring) === 0)
			matches.push(history[i]);
		if (matches.length >= se.settings.hMenuMaxLength)
			break;
	}
	if (matches.length < se.settings.hMenuMaxLength) {
		var round2Test = ' ' + substring;
		for (i = 0; i < history.length; i++) {
			if (history[i].indexOf(round2Test) > -1)
				matches.push(history[i]);
			if (matches.length >= se.settings.hMenuMaxLength)
				break;
		}
	}
	return matches;
}
function getSuggestions(queryString, callback) {
	var suggestions = [];
	var sUrl = 'http://google.com/complete/search?output=toolbar&q=' + queryString;
	// console.log('Getting suggestions for "' + queryString + '"');
	doXHR(sUrl, function () {
		if (this.responseXML) {
			var suggs = this.responseXML.getElementsByTagName('suggestion');
			for (var i = 0; i < suggs.length; i++) {
				suggestions.push(suggs[i].getAttribute('data'));
			}
			// console.log('Got suggestions.');
			callback(suggestions);
		}
	});
}
function handleBeforeSearch(event) {
	if (se.settings.handleABSearch) {
		event.preventDefault();
		var query = event.query;
		var engineIndex;
		var wordSearch = /(\S+) +(.+)/.exec(query);
		if (wordSearch) {
			var engines = JSON.parse(localStorage.engines);
			for (var i = engines.length - 1; i >= 0; i--) {
				if (engines[i].keyword === wordSearch[1]) {
					engineIndex = i; break;
				}
			}
			if (engineIndex !== undefined) {
				query = wordSearch[2];
			} else {
				engineIndex = getDefaultEngine();
			}
		} else {
			engineIndex = getDefaultEngine();
		}
		doSearch({
			input  : query, 
			eidx   : engineIndex,
			target : event.target,
			ck: false, mk: false, ok: false, sk: false,
		});
	}
}
function handleCommand(event) {
	switch (event.command) {
		case 'togglePSWin': {
			var activeTab = event.target.browserWindow.activeTab;
			if (se.toolbarItems.length && se.popovers && se.settings.usePopover) {
				se.toolbarItems.forEach(function (tbi) {
					if (tbi.browserWindow == event.target.browserWindow)
						if (tbi.popover.visible) tbi.popover.hide();
						else {
							activeTab.page.dispatchMessage('SendTextSelection');
							tbi.showPopover();
						}
				});
			}
			else activeTab.page.dispatchMessage('togglePSFrame');
			break;
		}
		case 'addThisEngine': {
			var urlTemplate = event.userInfo.urlTemplate;
			var newEngineName = '';
			var hostname = event.userInfo.hostname;
			if (hostname.indexOf('www.') === 0) {
				hostname = hostname.replace('www.','');
			}
			while (newEngineName === '') {
				newEngineName = prompt('What do you want to call the new engine?', hostname);
			}
			if (newEngineName) {
				var newEngineKeyword = ' ';
				while (newEngineKeyword !== null && newEngineKeyword.indexOf(' ') > -1) {
					newEngineKeyword = prompt(
						'What do you want to use as this engine\'s keyword? ' +
						'The keyword is optional. No spaces, please.');
				}
				if (newEngineKeyword !== null) {
					var newEditedUrl = '';
					while (newEditedUrl === '') { newEditedUrl = prompt(
							'Please check the search URL shown below. ' +
							'You may wish to remove any unnecessary parameters.', urlTemplate);
					}
					if (newEditedUrl) {
						addEngine(newEngineName, newEngineKeyword, newEditedUrl);
					}
				}
			} break;
		}
	}
}
function handleContextMenu(event) {
	if (event.userInfo) {
		event.contextMenu.appendContextMenuItem('addThisEngine','Add This Engine to PopSearch');
	}
}
function handleMessage(event) {
	switch (event.name) {
		case 'tellMyTopToPop': {
			self.textSelection = event.message;
			if (se.toolbarItems.length && se.popovers && se.settings.usePopover) {
				pw.mainDiv.show(event.message);
				se.toolbarItems.forEach(function (tbi) {
					if (tbi.browserWindow == event.target.browserWindow)
						tbi.showPopover();
				});
			}
			else event.target.page.dispatchMessage('insertPSFrame');
			break;
		}
		case 'saveSelection': {
			self.textSelection = event.message;
			break;
		}
		case 'removeMe': {    // event.message == andFocusParent
			event.target.page.dispatchMessage('removePSFrame', event.message);
			break;
		}
		case 'sendHistoryMatches': {
			var matches = getHistoryMatches(event.message);
			event.target.page.dispatchMessage('receiveHistoryMatches', matches);
			break;
		}
		case 'sendSuggestions': {
			getSuggestions(event.message, function (suggestions) {
				event.target.page.dispatchMessage('receiveHistoryMatches', suggestions);
			});
			break;
		}
		case 'doSearch': {
			doSearch(event.message);
			break;
		}
		case 'passMySettings': {
			var defaultEngine = (function () {
				switch (se.settings.engineDefault) {
					case 0:
						return se.settings.defaultEngine;
					case 1:
						return se.settings.lastEngine;
					case 2:
						if (!/^https?/.test(event.target.url))
							return se.settings.defaultEngine;
						var topHostPrefs = se.settings.topHostPrefs;
						var targetHostname = new RegExp('//([^/]+)/').exec(event.target.url)[1];
						for (var i = 0; i < topHostPrefs.length; i++) {
							if (targetHostname === topHostPrefs[i].hostname) {
								return topHostPrefs[i].lastEngine;
							}
						}
						return se.settings.defaultEngine;
					default: return se.settings.defaultEngine;
				}
			})();
			var message = {
				queryString    : self.textSelection,
				hotkey         : se.settings.hotkey,
				engines        : JSON.parse(localStorage.engines),
				defaultEngine  : defaultEngine,
				saveHistory    : se.settings.saveHistory,
				getSuggestions : se.settings.getSuggestions,
				style          : JSON.parse(localStorage.styles)[se.settings.selectedStyleIndex]
			};
			event.target.page.dispatchMessage('receiveSettings', message);
			break;
		}
		case 'passSettings': {
			var response = {};
			for (var i = 0; i < event.message.length; i++) {
				if (event.message[i] == 'engines')
					response[event.message[i]] = JSON.parse(localStorage.engines);
				else
					response[event.message[i]] = se.settings[event.message[i]];
			}
			event.target.page.dispatchMessage('receiveSettings', response);
			break;
		}
		case 'passSetting': {
			var message = { key: event.message };
			if (event.message == 'engines')
				message.value = JSON.parse(localStorage.engines);
			else
				message.value = se.settings[event.message];
			event.target.page.dispatchMessage('receiveSetting', message);
			break;
		}
		case 'openSettings': {
			sa.activeBrowserWindow.activeTab.page.dispatchMessage('removePSFrame', false);
			sa.activeBrowserWindow.openTab('foreground').url = se.baseURI + 'settings.html';
			break;
		}
		case 'saveHotkey': {
			se.settings.hotkey = event.message;
			event.target.page.dispatchMessage('receiveSettings', {hotkey:se.settings.hotkey});
			break;
		}
		case 'resetHotkey': {
			se.settings.hotkey = defaultHotkey;
			event.target.page.dispatchMessage('receiveSettings', {hotkey:se.settings.hotkey});
			break;
		}
		case 'setSetting': {
			se.settings[event.message.name] = event.message.value;
			break;
		}
		case 'setNewTabPosition': {
			var targetBits = se.settings.targetBits;
			targetBits.tp = event.message;
			se.settings.targetBits = targetBits;
			break;
		}
		case 'clearSiteHistory': {
			se.settings.topHostPrefs = [];
			break;
		}
		case 'clearSearchHistory': {
			se.settings.history = [];
			break;
		}
		case 'passPopoverPref': {
			event.target.page.dispatchMessage('popoverPref', se.settings.usePopover);
			break;
		}
		case 'saveEngine': {
			var engines = JSON.parse(localStorage.engines);
			var index = event.message.index;
			engines[index] = event.message.engineData;
			localStorage.engines = JSON.stringify(engines);
			var message = { key: 'engines', value: engines };
			event.target.page.dispatchMessage('receiveSetting', message);
			break;
		}
		case 'removeEngine': {
			var index = event.message;
			var engines = JSON.parse(localStorage.engines);
			var removedEngines = engines.splice(index,1);
			localStorage.engines = JSON.stringify(engines);
			if (se.settings.defaultEngine > engines.length-1) {
				se.settings.defaultEngine = engines.length-1;
			}
			var message = { key: 'engines', value: engines };
			event.target.page.dispatchMessage('receiveSetting', message);
			break;
		}
		case 'sortEngines': {
			var engines = JSON.parse(localStorage.engines);
			engines = sortEngines(engines, event.message);
			localStorage.engines = JSON.stringify(engines);
			var message = { key: 'engines', value: engines };
			event.target.page.dispatchMessage('receiveSetting', message);
			break;
		}
		case 'resetEngines': {
			var confirmed = confirm(
				'Are you sure you want to restore the default search engines? ' +
				'Any engines you have added will be permanently removed.'
			);
			if (confirmed) {
				initializeEngines();
				var message = { key: 'engines', value: JSON.parse(localStorage.engines) };
				event.target.page.dispatchMessage('receiveSetting', message);
			}
			break;
		}
		case 'pbExportEngines': {
			pbPrimeForExport(event.target);
			break;
		}
		case 'pbImportEngines': {
			pbImportEngines(event.target);
			break;
		}
		case 'passStyles': {
			var message = {
				styles: JSON.parse(localStorage.styles),
				sIndex: se.settings.selectedStyleIndex
			};
			event.target.page.dispatchMessage('receiveStyles', message);
			break;
		}
		case 'saveStyle': {
			var style = { name: event.message.sName, content: event.message.sContent };
			var styles = JSON.parse(localStorage.styles);
			var index = event.message.sIndex;
			if (index === -1)
				index = styles.length;
			styles[index] = style;
			localStorage.styles = JSON.stringify(styles);
			se.settings.selectedStyleIndex = index;
			var message = {
				styles : styles,
				sIndex : se.settings.selectedStyleIndex
			};
			event.target.page.dispatchMessage('receiveStyles', message);
			break;
		}
		case 'deleteStyle': {
			var styles = JSON.parse(localStorage.styles);
			styles.splice(event.message, 1);
			if (se.settings.selectedStyleIndex > 0)
				se.settings.selectedStyleIndex--;
			localStorage.styles = JSON.stringify(styles);
			var message = {
				styles : styles,
				sIndex : se.settings.selectedStyleIndex
			};
			event.target.page.dispatchMessage('receiveStyles', message);
			break;
		}
		case 'resetStyles': {
			var confirmed = confirm(
				'The default styles will be reset. Other styles will not be affected.'
			);
			if (confirmed) {
				initializeStyles();
				var message = {
					styles : JSON.parse(localStorage.styles),
					sIndex : se.settings.selectedStyleIndex
				};
				event.target.page.dispatchMessage('receiveStyles', message);
			}
			break;
		}
	}
}
function handleSettingChange(event) {
	if (event.newValue !== event.oldValue) {
		switch (event.key) {
			case 'usePopover':
				if (!se.popovers)
					se.settings.usePopover = false;
				break;
			case 'hotkey':
			case 'engines':
			case 'style':
				passSettingsToAllPages([event.key]);
				break;
			case 'openSettings':
				sa.activeBrowserWindow.openTab().url = se.baseURI + 'settings.html';
				break;
			default: break;
		}
	}
}
function initializeEngines() {
	var engines = [];
	engines.push(new Engine('Amazon','az',
		'http://www.amazon.com/s/?url=search-alias=aps&field-keywords=%s'));
	engines.push(new Engine('Bing','b','http://www.bing.com/search?q=%s'));
	engines.push(new Engine('Bing Here','bh','http://www.bing.com/search?q=%s+site:%h'));
	engines.push(new Engine('DuckDuckGo','d','http://duckduckgo.com/?q=%s'));
	engines.push(new Engine('Facebook','f','http://www.facebook.com/search/?q=%s'));
	engines.push(new Engine('Google','g','http://www.google.com/search?q=%s'));
	engines.push(new Engine('Google Here','gh','http://www.google.com/search?q=%s+site:%h'));
	engines.push(new Engine('Google Images','gi','http://www.google.com/images?q=%s'));
	engines.push(new Engine('IMDb','imdb','http://www.imdb.com/find?s=all&q=%s'));
	engines.push(new Engine('MacUpdate','mu','http://www.macupdate.com/find/%s'));
	engines.push(new Engine('Translate This Page','tp','http://translate.google.com/translate?u=%u'));
	engines.push(new Engine('Twitter','t','http://twitter.com/#!/search/%s'));
	engines.push(new Engine('Wikipedia','w','http://en.wikipedia.org/?search=%s'));
	engines.push(new Engine('Wolfram Alpha','wa','http://www.wolframalpha.com/input/?i=%s'));
	engines.push(new Engine('Yahoo!','y','http://search.yahoo.com/search?p=%s'));
	localStorage.engines = JSON.stringify(engines);
	se.settings.defaultEngine = 6;
	se.settings.lastEngine = se.settings.defaultEngine;
}
function initializeSettings() {
	var lastVersion = se.settings.lastVersion;
	for (var key in defaults) {
		if (se.settings[key] === undefined) {
			se.settings[key] = defaults[key];
		}
	}
	if (se.settings.usePopover === undefined)
		se.settings.usePopover = !!(se.popovers);
	if (!localStorage.engines)
		initializeEngines();
	if (!localStorage.styles)
		initializeStyles();
	if (lastVersion < 1000) {
		updateDefaultStyles();
		convertStyles();
		convertEngines();
	}
	if (lastVersion < 1105) {
		initializeStyles();
		se.settings.usePopover = !!(se.popovers);
	}
	if (lastVersion < 1108) {
		se.settings.targetBits.sn = true;
	}
	if (lastVersion < 1110) {
		se.settings.backupSvc = 'Delicious';
	}
	if (lastVersion < 1113) {
		updateDefaultStyles();
	}
	if (lastVersion < 1118) {
		se.settings.saveHistory = false;
		se.settings.hMenuMaxLength = 10;
		se.settings.getSuggestions = true;
	}
	if (lastVersion < 1126) {
		var oh = se.settings.hotkey;
		var om = se.settings.hotkey.m;
		if (om.length === 4)
			var nm = om.charAt(0)*8 + om.charAt(2)*4 + om.charAt(1)*2 + om.charAt(3)*1;
		else
			var nm = defaultHotkey.m;
		se.settings.hotkey = { k: oh.k, m: nm };
	}
	se.settings.lastVersion = 1135;
}
function initializeStyles() {
	localStorage.styles = JSON.stringify(defaultStyles);
	se.settings.selectedStyleIndex = 0;
}
function passSettingsToAllPages(keys) {
	var message = {};
	for (var i=0; i < keys.length; i++) {
		message[keys[i]] = se.settings[keys[i]];
	}
	for (var i in sa.browserWindows) {
		var thisWindow = sa.browserWindows[i];
		for (var j in thisWindow.tabs) {
			var thisTab = thisWindow.tabs[j];
			if (thisTab.url.indexOf('http') === 0 || thisTab.url === 'about:blank') {
				thisTab.page.dispatchMessage('receiveSettings', message);
			}
		}
	}
}
function pbExportEngines(target) {
	var baseUrl = (function () {
		switch (se.settings.backupSvc) {
			case 'Delicious': return 'https://api.del.icio.us/v1/posts/add';
			case 'Pinboard' : return 'https://api.pinboard.in/v1/posts/add';
		}
	})();
	var engines = JSON.parse(localStorage.engines);
	var responseHandler = function () {
		if (this.readyState === 4) {
			if (this.status === 200) {
				exportCount++;
				if (exportCount === engines.length) {
					target.page.dispatchMessage('exImResult','success');
				}
			} else {
				target.page.dispatchMessage('exImResult','failure');
				var notice = 'PopSearch could not log in to your Delicious or Pinboard account. ';
					notice += 'Please check your username and password.';
				alert(notice);
			}
		}
	};
	exportCount = 0;
	var svcUrl;
	var ei;
	for (var i = 0; i < engines.length; i++) {
		var ei = engines[i];
		svcUrl  = baseUrl + '?url=' + encodeURIComponent(ei.url);
		svcUrl += '&description=' + encodeURIComponent(ei.name);
		svcUrl += ei.keyword ? encodeURIComponent('::' + ei.keyword) : '';
		svcUrl += '&tags=PopSearch,NoMoof&replace=yes&shared=no';
		doXHR(svcUrl, responseHandler);
	}
}
function pbImportEngines(target) {
	var svcUrl = (function () {
		switch (se.settings.backupSvc) {
			case 'Delicious': return 'https://api.del.icio.us/v1/posts/all?&tag=PopSearch';
			case 'Pinboard' : return 'https://api.pinboard.in/v1/posts/all?&tag=PopSearch';
		}
	})();
	doXHR(svcUrl, function () {
		if (this.readyState === 4) {
			if (this.status === 200) {
				var pbEngines = null;
				var posts = this.responseXML.getElementsByTagName('post');
				if (posts.length > 0) {
					pbEngines = [];
					var engines = JSON.parse(localStorage.engines);
					for (var i = 0; i < posts.length; i++) {
						var nameAndKeyword = posts[i].getAttribute('description').split('::');
						var name = nameAndKeyword[0];
						var keyword = nameAndKeyword[1] || '';
						var url = posts[i].getAttribute('href');
						var ie = new Engine(name,keyword,url);
						var matchFound = false;
						for (var j = 0; j < engines.length; j++) {
							if (ie.url === engines[j].url) {
								engines[j] = ie;
								matchFound = true;
								break;
							}
							else if (ie.name === engines[j].name) {
								engines[j].name = engines[j].name + ' (old)';
							}
						}
						if (!matchFound) {
							engines.push(ie);
						}
					}
					localStorage.engines = JSON.stringify(sortEngines(engines,'name'));
					var message = { key: 'engines', value: JSON.parse(localStorage.engines) };
					target.page.dispatchMessage('receiveSetting', message);
					target.page.dispatchMessage('exImResult','success');
				}
			} else {
				target.page.dispatchMessage('exImResult','failure');
				var notice = 'PopSearch could not log in to your Delicious or Pinboard account. ';
					notice += 'Please check your username and password.';
				alert(notice);
			}
		}
	});
}
function pbPrimeForExport(target) {
	var svcUrl = (function () {
		switch (se.settings.backupSvc) {
			case 'Delicious': return 'https://api.del.icio.us/v1/posts/update';
			case 'Pinboard' : return 'https://api.pinboard.in/v1/posts/update';
		}
	})();
	target.page.dispatchMessage('exImResult','exporting');
	doXHR(svcUrl, function () {
		if (this.readyState === 4) {
			if (this.status === 200) {
				pbExportEngines(target);
			} else {
				target.page.dispatchMessage('exImResult','failure');
				var notice = 'PopSearch could not log in to your Delicious or Pinboard account. ';
					notice += 'Please check your username and password.';
				alert(notice);
			}
		}
	});
}
function saveHistoryItem(query) {
	var history = se.settings.history;
	for (var i in history) {
		if (query === history[i]) {
			history.splice(i,1);
			break;
		}
	}
	history.unshift(query);
	if (history.length > 500)
		history.pop();
	se.settings.history = history;
}
function saveTopHostPref(hostname,lastEngine) {
	var newHostPrefs = new HostPrefs(hostname, lastEngine);
	var topHostPrefs = se.settings.topHostPrefs;
	for (var i in topHostPrefs) {
		if (hostname === topHostPrefs[i].hostname) {
			topHostPrefs.splice(i,1);
			break;
		}
	}
	topHostPrefs.unshift(newHostPrefs);
	if (topHostPrefs.length > 100)
		topHostPrefs.pop();
	se.settings.topHostPrefs = topHostPrefs;
}
function sortEngines(engines,key) {
	engines.sort(function(a,b){
		var aProp = a[key].toLowerCase();
		var bProp = b[key].toLowerCase();
		if (aProp < bProp)
			return -1;
		if (aProp > bProp)
			return 1;
		return 0;
	});
	return engines;
}
function updateDefaultStyles() {
	var oldStyles = localStorage.styles ? JSON.parse(localStorage.styles) : se.settings.styles;
	var defaultStyleNames = ['Light','Dark'];
	for (var i in oldStyles) {
		var styleName = oldStyles[i].name;
		if (defaultStyleNames.indexOf(styleName) > -1) {
			oldStyles[i].name = styleName + ' (backup)';
		}
	}
	if (localStorage.styles) {
		localStorage.styles = JSON.stringify(defaultStyles.concat(oldStyles));
	} else {
		se.settings.styles = defaultStyles.concat(oldStyles);
	}
	se.settings.selectedStyleIndex = 0;
}

const defaults = {
	backupSvc      : 'Delicious',
	encodeQuery    : false,
	engineDefault  : 1,
	getSuggestions : true,
	handleABSearch : true,
	history        : [],
	hMenuMaxLength : 10,
	hotkey         : { k: 75, m: (mac) ? 8 : 4},
	saveHistory    : false,
	targetBits     : { nt:false, sn:true, uw:false, tb:false, ta:true, tp:1 },
	topHostPrefs   : [],
};
var globalInited = false;
var sa = safari.application;
var se = safari.extension;
var po = se.popovers ? se.popovers[0] : null;
var pw = po ? po.contentWindow : null;
var mac = /^Mac/.test(navigator.platform);
var exportCount = 0;
var textSelection = '';
var defaultHotkey = { k: 75, m: (mac) ? 8 : 4};

initializeSettings();

sa.addEventListener('beforeSearch', handleBeforeSearch, true);
sa.addEventListener('contextmenu', handleContextMenu, false);
sa.addEventListener('command', handleCommand, false);
sa.addEventListener('message', handleMessage, false);
se.settings.addEventListener('change', handleSettingChange, false);

globalInited = true;
