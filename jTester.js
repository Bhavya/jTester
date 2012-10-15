jTester = function jTester() {
   		var ntlut; // Lookup table
   		var macros = [];

   		this.pullNT = function() {
   			ntlut = this.Session.get("ntlut") || [];
   		}

   		this.pushNT = function(domEvt) {
   			ntlut.push(domEvt);
   			return this.Session.set("ntlut", ntlut);
   		};

   		this.popNT = function() {
   			popObj = ntlut.pop();
   			this.Session.store("ntlut", ntlut);
   			return popObj;
   		};

   		this.dumpNT = function(){
   			return ntlut;
   		};

   		this.clearNT = function(){
   			this.Session.set("ntlut", undefined);
   			return (ntlut.length = 0);
   		};

   		this.init();
   	};

   	jTester.prototype.XMLSerialize = function(node, output) {
	    output = (node.nodeName !== undefined)?
	    	{ nodeName: node.nodeName } : {};

	    if(node.attributes !== null) {
		    for (var i = 0; i < node.attributes.length; i++) {
		        output[node.attributes[i].name] = node.attributes[i].value;
		    }
		}

	    if (node.hasChildNodes()) {
	      output.children = [];
	      var i = 0;
	      for (var child=node.firstChild; child != null; child=child.nextSibling) {
	        if(child.nodeType == 1) {
	        	output.children[i++] = this.XMLSerialize(child, output.children);
	        }
	      }
	    }
		
	    return output;
	 }

   	jTester.prototype.DOMXPath = function(node, stack) {
	    stack = stack || [];

	    var output = (node.nodeName)?
	    	{ nodeName: node.nodeName } : {};

	    if(node.attributes !== null) {
		    for (var i = 0; i < node.attributes.length; i++) {
		        output[node.attributes[i].name] = node.attributes[i].value;
		    }
		}

	    if (node.parentNode !== null) {
			var parent = node.parentNode;
			var i = 0;
			for (var child=parent.firstChild; child != null; child=child.nextSibling) {
				if(child.nodeType == 1 && child == node) {
					output.index = i;
					stack.push(output);
					this.DOMXPath(parent, stack);
					break;
				}
				i++;
			}
		} else {
			stack.push(output);
		}

		return stack;
	}

	// array clone hack
   	jTester.prototype.clone = function(obj) {
   		return JSON.parse(JSON.stringify(obj));
   	}

   	jTester.prototype.hasClass = function(elem, cssClass) {
		return elem.className.match(new RegExp('(\\s|^)'+ cssClass +'(\\s|$)'));
	}

	jTester.prototype.addClass = function(elem, cssClass) {
		if (!this.hasClass(elem,cssClass)) elem.className += " " + cssClass;
	}

	jTester.prototype.removeClass = function(elem, cssClass) {
		if (this.hasClass(elem, cssClass)) {
			var reg = new RegExp('(\\s|^)'+ cssClass +'(\\s|$)');
			elem.className = elem.className.replace(reg,' ');
		}
	}

   	jTester.prototype.init = function() {
   		this.timingFlag = false;
   		this.observerFlag = false;

   		//Session hack
   		if(typeof(Storage)){
   			local_storage = true;
   		}


		this.Session = this.Session || (function() {
			var localStorageSupport = 
				(typeof(Storage)!=="undefined")? true : false;

			var win = window.top || window;
			var store = (localStorageSupport)?
				(sessionStorage.getItem("store") ? 
					JSON.parse(sessionStorage.getItem("store")) : {})
				:(win.name ? JSON.parse(win.name) : {});
			
			return {
				save: function() {
					if(localStorageSupport) {
						sessionStorage.setItem("store", JSON.stringify(store));
						return true;
					} else {
						win.name = JSON.stringify(store);
						return true;
					}
					return false;
				},
				set: function(name, value) {
					store[name] = value;
					return this.save();
				},		
				get: function(name) {
					return (store[name] ? store[name] : undefined);
				},
				clear: function() { store = {}; return this.save(); },
				dump: function() { return store; }			 
			};
		})();	
		
		this.mode = (function() {
			var self = this.Session.get("mode") || 0x00;
			return {
				mode: function() { return self; },
				stall: function() { 
					self = 0x00; 
					return this.save();
				},
				stalling: function() { return (self == 0x00); },
				record: function() { 
					self = 0x01;
					return this.save(); 
				},
				recording: function() { return (self == 0x01); },
				run: function() { 
					self = 0x02;
					return this.save(); 
				},
				running: function() { return (self == 0x02); },
				save: function() { 
					return this.Session.set("mode", self); 
				}.bind(this)
			};
		}.bind(this))();

   		this.setUpUI();
   		this.pullSessionDataPTrans();
   		this.setUpEventListeners();
   		
   		this.observerFlag = true;
   	};

   	jTester.prototype.setUpUI = function() {
   		this._body = document.getElementsByTagName('body')[0];
   		this._panel = document.createElement('div');
   		this._panel.className += "panel";

   		// The start and stop recording button
   		this._start = document.createElement('button');
   		this._start.id = "jTesterStartButton";
   		this._start.innerText = "Start Recording";
   		this.addClass(this._start, "start");	
   		this._start.toggle = function() {
   			if(this.mode.recording()) {
   				this.mode.stall();
   				this._start.innerHTML = "Stop Recording";
   			} else {
   				this.mode.record();
   				this._start.innerHTML = "Start Recording";
   			}
   			return;
   		}.bind(this);

   		this._withTiming = document.createElement('input');
   		this._withTiming.type = "checkbox";
   		this._withTiming.id = "jTesterWithTiming";
   		var labelT = document.createElement('label')
		labelT.htmlFor = "jTesterWithTiming";
		labelT.appendChild(document.createTextNode('Preserve Timing'));

		this._withObservation = document.createElement('input');
   		this._withObservation.type = "checkbox";
   		this._withObservation.id = "jTesterWithObservation";
   		var labelO = document.createElement('label')
		labelO.htmlFor = "jTesterWithObservation";
		labelO.appendChild(document.createTextNode('Use Human Timing'));

		// The save macros button
   		this._save = document.createElement('button');
   		this._save.id = "jTesterStopButton";
   		this._save.innerText = "Save Macro";
   		this._save.save = function() {
   			if(this.mode.recording()) {
   				alert("Please stop recording first.");
   				return;
   			}
   			this.macros.push(this.clone(this.dumpNT()));
   			this.clearNT();
   		}.bind(this);

   		// The logging console
   		this._log = document.createElement('div');
   		this.addClass(this._log, "log");
   		this._log.clear = function(){
   			this.innerHTML = "";
   			return;
   		};

   		this._panel.appendChild(this._start);
   		this._panel.appendChild(this._withTiming);
   		this._panel.appendChild(labelT);
   		this._panel.appendChild(this._withObservation);
   		this._panel.appendChild(labelO);
   		this._panel.appendChild(this._save);
   		this._panel.appendChild(this._log);
   		this._body.appendChild(this._panel);
   	}

   	jTester.prototype.pullSessionDataPTrans = function() {
   		this.pullNT();

   		if(this.mode.recording()) {
   			this._start.toggle();
   			this._log.innerHTML = this.Session.get("log");
   		} else if(this.mode.running()) {
   			this.log("Running Macro");
   			this.macro().run();
   		}
   	}

   	jTester.prototype.log = function(str) {
   		item = document.createElement('div');
   		item.innerText = str;
   		this._log.insertBefore(item, this._log.childNodes[0]);
   		this.Session.set("log", this._log.innerHTML);
   	}

   	jTester.prototype.setUpEventListeners = function() {
   		var eventTypes = [
   			'click', 
   			'focus',
   			'keypress'
   		];

		this._start.addEventListener('click', function(e) {
		    (this._start.toggle.bind(this))();
		    e.stopPropagation();
		}.bind(this));

		this._save.addEventListener('click', function(e) {
		    (this._save.save.bind(this))();
		    e.stopPropagation();
		}.bind(this));

		for(var i = 0; i < eventTypes.length; ++i) {
			type = eventTypes[i];
			document.addEventListener(type, function(e){
				if(this.mode.recording()) {
					var elem, evt = e ? e:event;
					if (evt.srcElement)  elem = evt.srcElement;
					else if (evt.target) elem = evt.target;

					var domEvt = {};
					domEvt._xpath = (this.DOMXPath(elem));
					domEvt._element = elem.nodeName; 
					domEvt._event = evt.type;

					for(var i =0; 
						i < elem.parentNode.childNodes.length; 
						i++) {
						if(elem.parentNode.childNodes[i] == elem){
							domEvt._index = i;
							break;
						}
					}
					 
					this.log(evt.type.toUpperCase() + ' event: <'+elem.tagName.toUpperCase()+'>\n');
					this.pushNT(domEvt);
					this.Session.set("macro",this.dumpNT());
					return true;
				}
			}.bind(this));
		}
   	}

   	jTester.prototype.isolateEventNode = function(domEvt) {
   		var current = document;
   		var xpath = this.clone(domEvt._xpath);
   		xpath.pop(); // pop the doc
   		while((node = xpath.pop()) !== undefined) {
   			current = current.childNodes[node.index];
   		}
   		return current;
   	}

   	jTester.prototype.dispatchEvent = function(node, evt) {
   		switch(evt) {
   			case 'click':
   				node.click();
   				console.debug("Click fired on", node);
   				break;
   			case 'focus':
   				node.focus();
   				break;
   			default:
   				break;
   		}
   	}

   	jTester.prototype.macro = function() {
   		return {
	   		run: function() {
		   		var $this = this;
		   		var macro = (this.mode.running())? 
		   			this.Session.get("macroInProg") :
		   			this.clone(this.dumpNT()).reverse(); 
		   		this.mode.run();
		   		var i = 1;
		   		while ((domEvt = macro.pop()) !== undefined){
		   			current = this.isolateEventNode(domEvt);
		   			console.log(current);
		   			evt = domEvt._event;
		   			timeout_i = (this.observerFlag)? 500*i++: 0;
		   			timeout_s = (this.observerFlag)? 500*i++: 0;
		   			
		   			(function (current, evt) {
			   			setTimeout(
			   				function(){
			   					this.addClass(current, 'focus');
			   				}.bind($this),
			   				timeout_i
			   			);

			   			setTimeout(
			   				function(){
			   					this.dispatchEvent(current, evt);
			   					this.removeClass(current, 'focus');	
			   				}.bind($this),
			   				timeout_s
			   			);
			   		})(current, evt);

			   		this.Session.set("macroInProg", macro);
			   		if(domEvt._element == 'A') {
			   			return;
			   		}
	   			}

	   			setTimeout(
	   				function() { 
	   					this.macro().tidyUp() 
	   				}.bind($this),
	   				500*i++
	   			);

	   			return;
	   		}.bind(this),

	   		tidyUp: function() {
	   			this.clearNT();
	   			this.mode.stall();
	   			this._log.clear();
	   			this.Session.set("macroInProg", undefined);
	   			this.log("Macro complete");
	   			return;
	   		}.bind(this)
	   	};
   	}

	var readyStateCheckInterval = setInterval(function() {
	    if (document.readyState === "complete") {
		        j = new jTester();
		        clearInterval(readyStateCheckInterval);
		    }
	}, 10);