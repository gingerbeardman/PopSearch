function buildEngineMenu() {
	engines = iframed ? settings.engines : JSON.parse(localStorage.engines);
	engineKeys = [];
	var engineOptions = [];
	for (var i in engines) {
		engineKeys[i] = engines[i].keyword;
		engineOptions[i] = document.createElement('option');
		engineOptions[i].innerHTML = engines[i].name;
	}
	if (engineMenu.childNodes.length > 0) {
		engineCount = engineMenu.childNodes.length;
		for (var i=0; i<engineCount; i++) {
			engineMenu.removeChild(engineMenu.childNodes[0]);
		}
	}
	for (var i in engineOptions) {
		engineMenu.appendChild(engineOptions[i]);
	}
	if (defaultEngine < engines.length) {
		engineMenu.selectedIndex = defaultEngine;
	} else {
		engineMenu.selectedIndex = engines.length-1;
	}
}
function doSearch(e) {
	if (e.button == undefined || e.button == 0) {
		var eIndex = engineMenu.selectedIndex;
		var input = queryField.value;
		var args = {
			input : queryField.value,
			eidx  : eIndex,
			mk	  : e.metaKey,
			ok	  : e.altKey,
			ck	  : e.ctrlKey,
			sk	  : e.shiftKey
		};
		goAway(false);
		if (iframed)
			safari.self.tab.dispatchMessage('doSearch', args);
		else
			gpw.doSearch(args);
	}
}
function getSuggestionsLater(queryString) {
	window.suggestionsRequestWait = setTimeout(function () {
		window.suggestionsRequestWait = null;
		if (popover) {
			gpw.getSuggestions(queryString, function (suggestions) {
				historyMenu.populate(suggestions);
			});
		} else {
			safari.self.tab.dispatchMessage('sendSuggestions', queryString);
		}
	}, 100);
}
function goAway(andFocusParent) {
	if (popover) {
		if (lion) {
			safari.self.hide();
		} else {
			setTimeout('safari.self.hide()', 100);
		}
	}
	else safari.self.tab.dispatchMessage('removeMe', andFocusParent);
}
function handleMessage(e) {
	switch (e.name) {
		case 'receiveSettings': {
			for (var key in e.message)
				settings[key] = e.message[key];
			if (settings.defaultEngine)
				defaultEngine = settings.defaultEngine;
			if (settings.style)
				document.getElementById('stylesheet').innerHTML = settings.style.content;
			if (settings.engines)
				buildEngineMenu();
			mainDiv.show(settings.queryString);
			break;
		}
		case 'receiveHistoryMatches': {
			historyMenu.populate(e.message);
			break;
		}
	}
}
function handleMessageForPopover(e) {
	switch (e.name) {
		case 'TextSelectionIs': {
			if (e.message.length > 0) {
				gpw.textSelection = e.message;
				console.log('gpw.textSelection: "' + gpw.textSelection + '"');
				mainDiv.show(e.message);
			} else {
				mainDiv.show();
			}
			break;
		}
	}
}
function initialize() {
	popover = !!(safari.self.identifier);
	iframed = !popover;
	lion = (navigator.appVersion.indexOf('10_7') > -1);
	safari51 = (navigator.appVersion.indexOf('AppleWebKit/534') > -1);
	if (popover) {
		gpw = safari.extension.globalPage.contentWindow;
		console = gpw.console;
		if (!gpw.globalInited) {
			console.log('Global page not finished initializing!');
			setTimeout('initialize()', 500);
			return false;
		}
		console.log('Initializing popover.');
		settings = safari.extension.settings;
		document.body.className = 'popover';
		document.getElementById('stylelink').href = 'popover.css';
	} else {
		settings = {};
		document.body.className = 'iframed';
	}
	queryString = '';
	keyId = null;
	mainDiv = document.getElementById('ps_outerdiv');
	var handleControlFocus = function (e) {
		if (popover && safari51 && lion) {
			this.style.outline = 'auto -webkit-focus-ring-color';
		}
	};
	var handleControlBlur = function (e) {
		if (popover && safari51 && lion) {
			this.style.outline = '';
		}
	};
	queryField = document.getElementById('ps_queryfield');
	queryField.style.webkitAppearance = 'textfield';
	queryField.onfocus = handleControlFocus;
	queryField.onkeydown = function (e) {
		e.stopPropagation();
		keycode = e.which;
		switch (keycode) {
			case 13: {	//enter
				e.preventDefault();
				doSearch(e);
				break;
			}
			case 32: {	//space
				var keyword = queryField.value.split(' ', 1)[0];
				var kwIndex = engineKeys.indexOf(keyword);
				if (kwIndex > -1) {
					engineMenu.selectedIndex = kwIndex;
					e.preventDefault();
					queryField.value = '';
					historyMenu.style.display = 'none';
					if (window.suggestionsRequestWait) {
						clearTimeout(window.suggestionsRequestWait);
						window.suggestionsRequestWait = null;
						historyMenu.skipNextPopulate = true;
					}
					if (popover) {
						safari.self.height = mainDiv.clientHeight;
					}
				} break;
			}
			case 38: {	//up
				if (!e.shiftKey) {
					e.preventDefault();
					if (historyMenu.style.display === 'inline') {
						historyMenu.selectPrevious();
						var selectedMatch = historyMenu.options[historyMenu.selectedIndex];
						queryField.value = selectedMatch.innerHTML;
					}
				} break;
			}
			case 40: {	//down
				if (!e.shiftKey) {
					e.preventDefault();
					if (historyMenu.style.display === 'inline') {
						historyMenu.selectNext();
						var selectedMatch = historyMenu.options[historyMenu.selectedIndex];
						queryField.value = selectedMatch.innerHTML;
					} else {
						safari.self.tab.dispatchMessage('sendHistoryMatches', this.value);
					}
				} break;
			}
		}
	};
	queryField.onkeyup = function (e) {
		if (!keycode) return;
		if (settings.getSuggestions) {
			e.stopPropagation();
			var c = String.fromCharCode(e.which);
			var re = /[0-9 A-Z]/;
			if (re.test(c) && this.value.length > 2) {
				initiateGetSuggestions(this.value);
			} else if (e.which === 8 || e.which === 46) {
				if (this.value.length > 2) {
					initiateGetSuggestions(this.value);
				} else {
					clearTimeout(window.suggestionsRequestWait);
					window.suggestionsRequestWait = null;
					historyMenu.style.display = 'none';
					if (popover) {
						safari.self.height = mainDiv.clientHeight;
					}
				}
			}
		} else
		if (settings.saveHistory) {
			e.stopPropagation();
			var c = String.fromCharCode(e.which);
			var re = /[0-9 A-Z]/;
			if (re.test(c) && this.value) {
				if (popover) historyMenu.populate(gpw.getHistoryMatches(this.value));
				else safari.self.tab.dispatchMessage('sendHistoryMatches', this.value);
			} else if (e.which === 8 || e.which === 46) {
				if (this.value) {
					if (popover) historyMenu.populate(gpw.getHistoryMatches(this.value));
					else safari.self.tab.dispatchMessage('sendHistoryMatches', this.value);
				} else {
					historyMenu.style.display = 'none';
					if (popover) {
						safari.self.height = mainDiv.clientHeight;
					}
				}
			}
		}
	};
	queryField.onclick = function (e) {
		var cs = document.defaultView.getComputedStyle(this);
	};
	queryField.onblur = handleControlBlur;
	queryField.addEventListener('blur', function (e) {
		historyMenu.style.display = 'none';
		if (popover) {
			safari.self.height = mainDiv.clientHeight;
		}
	}, false);
	engineMenu = document.getElementById('ps_enginemenu');
	engineMenu.onfocus = handleControlFocus;
	engineMenu.onkeydown = function (e) {
		switch (e.which) {
			case 13: {	//enter
				e.preventDefault();
				doSearch(e);
				break;
			}
		}
	};
	engineMenu.onblur = handleControlBlur;
	goButton = document.getElementById('ps_gobutton');
	goButton.onfocus = handleControlFocus;
	goButton.onclick = doSearch;
	goButton.onkeydown = function (e) {
		switch (e.which) {
			case 13: case 32: {	 //enter, space
				e.preventDefault();
				doSearch(e);
				break;
			}
		}
	};
	goButton.onblur = handleControlBlur;
	settingsButton = document.getElementById('ps_settingsbutton');
	settingsButton.onfocus = handleControlFocus;
	settingsButton.onclick = openSettingsPage;
	settingsButton.onkeydown = function (e) {
		switch (e.which) {
			case  9: {	//tab
				e.preventDefault();
				queryField.focus();
				break;
			}
			case 13: case 32: {	 //enter, space
				e.preventDefault();
				openSettingsPage(e);
				break;
			}
		}
	};
	settingsButton.onblur = handleControlBlur;
	historyMenu = document.getElementById('ps_historymenu');
	historyMenu.onchange = function (e) {
		var selectedMatch = historyMenu.options[historyMenu.selectedIndex];
		queryField.value = selectedMatch.innerHTML;
	};
	historyMenu.onkeydown = function (e) {
		e.stopPropagation();
		e.preventDefault();
		switch (e.which) {
			case  9: {	//tab
				engineMenu.focus();
				break;
			}
			case 13: case 32: {	 //enter, space
				this.blur();
				doSearch(e);
				break;
			}
			case 27: {	//escape
				queryField.focus();
				break;
			}
			case 38: {	//up
				if (historyMenu.selectedIndex === 0)
					queryField.focus();
				break;
			}
			case 40: {	//down
				if (historyMenu.selectedIndex === historyMenu.options.length - 1)
					queryField.focus();
				break;
			}
		}
	};
	historyMenu.populate = function (matches) {
		if (historyMenu.skipNextPopulate) {
			console.log('skipNextPopulate');
			historyMenu.skipNextPopulate = false;
			return;
		}
		this.style.display = 'none';
		this.innerHTML = '';
		this.size = 0;
		for (var i = 0; i < matches.length; i++) {
			var menuItem = document.createElement('option');
			menuItem.onmousedown = function (e) {
				return false;
			}
			menuItem.onclick = function (e) {
				queryField.value = e.currentTarget.innerHTML;
				setTimeout(function () {
					historyMenu.style.display = 'none';
				}, 250);
			};
			menuItem.ondblclick = function (e) {
				historyMenu.style.display = 'none';
				doSearch(e);
			};
			menuItem.defaultSelected = false;
			menuItem.selected = false;
			menuItem.className = 'cksse_HistoryMatch';
			menuItem.innerHTML = matches[i];
			this.add(menuItem);
		}
		var menuItems = this.options;
		if (menuItems.length > 0) {
			this.size = (menuItems.length === 1) ? 2 : menuItems.length;
			this.selectedIndex = -1;
			this.style.left = queryField.offsetLeft + 'px';
			this.style.top = queryField.offsetTop + queryField.offsetHeight + 'px';
			this.style.minWidth = queryField.offsetWidth - 4 + 'px';
			this.style.display = 'inline';
		} else {
			this.style.display = 'none';
		}
		if (popover) {
			safari.self.height = mainDiv.clientHeight + historyMenu.clientHeight;
		}
	}
	historyMenu.selectNext = function () {
		if (this.selectedIndex === -1 || this.selectedIndex === this.options.length - 1) {
			this.selectedIndex = 0;
		} else {
			this.selectedIndex++;
		}
	}
	historyMenu.selectPrevious = function () {
		if (this.selectedIndex === -1 || this.selectedIndex === 0) {
			this.selectedIndex = this.options.length - 1;
		} else {
			this.selectedIndex--;
		}
	}
	mainDiv.show = function (queryString) {
		this.style.visibility = 'visible';
		queryField.focus();
		if (queryString) {
			queryField.value = queryString;
			queryField.select();
		}
	};
	document.addEventListener('keydown', function (e) {
		if (e.which === 27) {
			goAway(true);
			return;
		}
		var m = e.shiftKey * 1 + e.altKey * 2 + e.ctrlKey * 4 + e.metaKey * 8;
		if (e.which === settings.hotkey.k && m === settings.hotkey.m) {
			var forbiddenTargets = ['INPUT','BUTTON','SELECT','TEXTAREA'];
			var elementIsForbidden = (forbiddenTargets.indexOf(e.target.nodeName) > -1);
			if (m >= 4 || !elementIsForbidden) {
				e.preventDefault();
				e.stopPropagation();
				if (iframed) goAway(true);
				else {
					var handleHotKeyUp = function (e) {
						document.removeEventListener('keyup', handleHotKeyUp, true);
						goAway(false);
					};
					document.addEventListener('keyup', handleHotKeyUp, true);
				}
			}
		}
	}, true);
	if (iframed) {
		document.body.addEventListener('click', function (e) {
			if (e.button == 0 && e.target == e.currentTarget) goAway(true);
		}, false);
		safari.self.addEventListener('message', handleMessage, false);
		safari.self.tab.dispatchMessage('passMySettings');
	} else {
		window.onfocus = function (e) {
			keycode = null;
			switch (settings.engineDefault) {
				case 1:
					defaultEngine = settings.lastEngine;
					break;
				case 2:
					var activeUrl = safari.application.activeBrowserWindow.activeTab.url;
					if (activeUrl.indexOf('//') > 0) {
						var targetHostname = activeUrl.split('//')[1].split('/')[0];
						for (var i in settings.topHostPrefs) {
							if (targetHostname === settings.topHostPrefs[i].hostname) {
								defaultEngine = settings.topHostPrefs[i].lastEngine;
								break;
							}
						}
					}
					break;
				default: break;
			}
			buildEngineMenu();
		};
		window.onblur = function (e) {
			// queryField.value = '';
			historyMenu.populate([]);
			safari.self.height = mainDiv.clientHeight;
		};
		safari.application.addEventListener('message', handleMessageForPopover, false);
		defaultEngine = settings.defaultEngine;
		buildEngineMenu();
		// safari.self.width = mainDiv.clientWidth;
		safari.self.height = mainDiv.clientHeight;
		mainDiv.show();
	}
}
function initiateGetSuggestions(queryString) {
	if (window.suggestionsRequestWait)
		clearTimeout(window.suggestionsRequestWait);
	getSuggestionsLater(queryString);
}
function openSettingsPage(e) {
	if (e.button == undefined || e.button == 0) {
		if (popover) {
			safari.application.activeBrowserWindow.openTab().url =
			 safari.extension.baseURI + 'settings.html';
		}
		else safari.self.tab.dispatchMessage('openSettings');
		goAway(false);
	}
}
var keycode = null;
