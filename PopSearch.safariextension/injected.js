var PopSearch = {
	hotkey : {},
	PSFrame : function () {
		var f = document.createElement('iframe');
		f.id = 'cksse_iframe';
		f.name = 'cksse_iwin';
		f.src = safari.extension.baseURI + 'popsearch.html';
		f.style.cssText = '\
			position: fixed !important; \
			z-index: 2147483647 !important; \
			left: 0 !important; top: 0 !important; \
			width: 100% !important; height: 100% !important; \
			border-width: 0 !important; \
			background: transparent !important; \
			opacity: 0; \
		';
		return f;
	},
	handleKeyDown : function (e) {
		if (!PopSearch.psFrame) {
			var k = e.which;
			var m = e.shiftKey * 1 + e.altKey * 2 + e.ctrlKey * 4 + e.metaKey * 8;
			if (k === PopSearch.hotkey.k && m === PopSearch.hotkey.m) {
				var forbiddenTargets = ['INPUT','BUTTON','SELECT','TEXTAREA'];
				var elementIsForbidden = (forbiddenTargets.indexOf(e.target.nodeName) > -1);
				var elementIsEditable = e.target.isContentEditable;
				if (m >= 4 || (!elementIsForbidden && !elementIsEditable)) {
					e.preventDefault();
					var selectedText = window.getSelection().toString();
					safari.self.tab.dispatchMessage('tellMyTopToPop', selectedText); 
				}
			}
		}
	},
	handleContextMenu : function (e) {
		if (e.target.nodeName === 'INPUT') {
			var inputField = e.target;
			var searchTerms = '';
			var urlTemplate = '';
			if ((inputField.type == 'text' || inputField.type == 'search') && inputField.value) {
				var plusEncodedTerms = inputField.value;
				while (plusEncodedTerms.indexOf(' ') > -1)
					plusEncodedTerms = plusEncodedTerms.replace(' ', '+');
				var percentEncodedTerms = inputField.value;
				while (percentEncodedTerms.indexOf(' ') > -1)
					percentEncodedTerms = percentEncodedTerms.replace(' ', '%20');
				if (window.location.href.indexOf(inputField.value) > -1) {
					searchTerms = inputField.value;
					urlTemplate = window.location.href.replace(inputField.value, '%s');
				}
				else if (window.location.href.indexOf(plusEncodedTerms) > -1) {
					searchTerms = inputField.value;
					urlTemplate = window.location.href.replace(plusEncodedTerms, '%s');
				}
				else if (window.location.href.indexOf(percentEncodedTerms) > -1) {
					searchTerms = inputField.value;
					urlTemplate = window.location.href.replace(percentEncodedTerms, '%s');
				}
			}
			if (searchTerms) {
				var userInfo = { 
					searchTerms: searchTerms, 
					urlTemplate: urlTemplate, 
					hostname: window.location.hostname
				};
				safari.self.tab.setContextMenuEventUserInfo(e, userInfo);
			}
		}
	},
	handleMessage : function (e) {
		switch (e.name) {
			case 'receiveSettings': {
				if (e.message.hotkey)
					PopSearch.hotkey = e.message.hotkey;
				break;
			}
			case 'SendTextSelection': {
				safari.self.tab.dispatchMessage('TextSelectionIs', window.getSelection().toString()); 
				break;
			}
		}
	},
	handleMessageForTop : function (e) {
		switch (e.name) {
			case 'insertPSFrame': {
				PopSearch.insertPSFrame();
				break;
			}
			case 'removePSFrame': {		// event.message == andFocusParent
				if (PopSearch.psFrame) {
					PopSearch.removePSFrame();
					if (e.message) window.focus();
				} break;
			}
			case 'togglePSFrame': {
				if (PopSearch.psFrame) {
					PopSearch.removePSFrame();
					window.focus();
				} else {
					safari.self.tab.dispatchMessage('saveSelection', window.getSelection().toString());
					PopSearch.insertPSFrame();
				}
				break;
			}
			case 'focusYourself': {
				window.focus();
				break;
			}
			case 'loadUrl': {
				window.location.href = e.message;
				break;
			}
		}
	},
	insertPSFrame : function () {
		this.psFrame = document.body.appendChild(new this.PSFrame);
		setTimeout(function () {
			PopSearch.psFrame.style.opacity = '1';
		}, 50); /*
		PopSearch.fadeInTimer = setInterval(function () {
			var currop = PopSearch.psFrame.style.opacity * 1;
			currop = currop + 0.25;
			PopSearch.psFrame.style.opacity = currop + '';
			if (currop >= 1) clearInterval(PopSearch.fadeInTimer);
		}, 10);*/
	},
	removePSFrame : function () {
		document.body.removeChild(this.psFrame);
		this.psFrame = null;
	},
};

if ((/^http/.test(location.protocol) || location.href == 'about:blank') && window.name != 'cksse_iwin') {
	document.addEventListener('keydown', PopSearch.handleKeyDown, false);
	document.addEventListener('contextmenu', PopSearch.handleContextMenu, false);
	safari.self.addEventListener('message', PopSearch.handleMessage, false);
	if (window == window.top)
		safari.self.addEventListener('message', PopSearch.handleMessageForTop, false);
	safari.self.tab.dispatchMessage('passSettings', ['hotkey']);
	if (document.title == 'AutoPopSearch') {
		PopSearch.autoPop = true;
		PopSearch.insertPSFrame();
	}
}
