var global = this;
var JSI;
(function (JSI) {
    var Injector = /** @class */ (function () {
        function Injector(Parent) {
            if (Parent === void 0) { Parent = null; }
            this.Parent = Parent;
            //private Registrations : Array<Registration> = new Array<Registration>(); 
            //private Resolutions : Array<Resolution> =new Array<Resolution>();    //Items that have been resolved by this Injector
            this.Registrations = {};
            this.Resolutions = {};
            this.BuildStack = new Array(); //stack a items being resolved
            this.InitDefinitions = new Array(); //definitions that need to be resolved at startup
            //callbacks used to register types  These get called on first require, because definie init is processed
            //last min chance to register types
            this.RegistrationCallbacks = new Array();
        }
        Injector.prototype.getKey = function (providedKey) {
            if (typeof providedKey === 'function' || typeof providedKey === 'object') {
                var objectIdKey = '__ObjectID';
                if (providedKey[objectIdKey] === undefined) {
                    providedKey[objectIdKey] = UniqueIdGenerator.UniqueId('__ObjectID');
                }
                return providedKey[objectIdKey];
            }
            return providedKey.toString();
        };
        //pulls resolution off of our resolutions, or some other scope object
        Injector.prototype.getResolution = function (key, scope) {
            if (scope === void 0) { scope = null; }
            scope = scope || this.Resolutions;
            if (scope[key]) {
                var value = scope[key];
                return value;
            }
            return undefined;
        };
        //resolve an array of keys
        Injector.prototype.resolveDependencies = function (dependencies) {
            var _this = this;
            dependencies = dependencies || [];
            var values = [];
            dependencies.forEach(function (key) {
                var value = _this.Resolve(key);
                values.push(value);
            });
            return values;
        };
        Injector.prototype.initialize = function (init) {
            var keys = Object.keys(init);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                var value = init[key];
                this.RegisterInstance(key, value);
            }
        };
        //create an object from the registration
        Injector.prototype.CreateFromRegistration = function (registration) {
            var factory;
            if (registration.Instance) {
                var instance = registration.Instance;
                factory = function () { return instance; };
            }
            else {
                var dependencyKeys = registration.Dependencies;
                if (!dependencyKeys) {
                    dependencyKeys = this.GetDependenciesFromType(registration.Factory);
                }
                var dependencyValues = this.resolveDependencies(dependencyKeys);
                var _factory = this.CreateFromFactoryMethod.bind(this, registration.Factory, dependencyValues);
                var lm = registration.LifetimeManager || new SingletonLifetimeManager();
                if (lm) {
                    //create a resolution 
                    factory = lm.GetFactory(_factory);
                }
            }
            return new Resolution(factory);
        };
        //invokes the factory method, either using the return value or *this* reference constructor style
        Injector.prototype.CreateFromFactoryMethod = function (factory, dependencyValues) {
            var value = Object.create(factory.prototype);
            var returnValue = factory.apply(value, dependencyValues);
            value = returnValue || value;
            return value;
        };
        //get definition for the provided key, from local or parent scope
        Injector.prototype.GetRegistration = function (key) {
            var k = this.getKey(key);
            if (this.Registrations[k]) {
                return this.Registrations[k];
            }
            if (this.Parent) {
                return this.Parent.GetRegistration(k);
            }
            return null;
        };
        Injector.prototype.EnsureInitialized = function () {
            var _this = this;
            if (!this.initialized) {
                this.initialized = true;
                this.RegistrationCallbacks.forEach(function (act) { return act(); });
                this.InitDefinitions.forEach(function (key) { return _this.Resolve(key); });
            }
        };
        Injector.prototype.CheckResolveLoop = function (key) {
            if (this.BuildStack.indexOf(key) > -1) {
                //unsure of the formatting here, just want to have consise logs, if we are resolving types, just write the type name
                var current = key.name ? 'TYPE: ' + key.name : key;
                var prev = this.BuildStack.pop();
                prev = prev.name ? 'TYPE: ' + prev.name : prev;
                throw new Error('require loop detected building ' + current + ' for ' + prev);
            }
        };
        //setup a registration
        Injector.prototype.RegisterOptions = function (options) {
            if (!options.Key) {
                throw new Error('Registration must have a key');
            }
            //if the key is a constructor, and we dont have a factory, assume the key is the factory.
            if (!options.Factory && typeof options.Key === 'function') {
                options.Factory = options.Key;
            }
            //replace the key with the derived key
            options.Key = this.getKey(options.Key);
            var reg = new Registration(options);
            this.Registrations[reg.Key] = reg;
            return reg;
        };
        Injector.prototype.RegisterCallback = function (callback) {
            if (this.initialized) {
                throw new Error('Registration Callback added when injector is already initialized');
            }
            this.RegistrationCallbacks.push(callback);
        };
        //old fashion register
        Injector.prototype.Register = function (key, dependencies, factory) {
            if (dependencies === void 0) { dependencies = null; }
            if (factory === void 0) { factory = null; }
            return this.RegisterOptions({ Key: key, Dependencies: dependencies, Factory: factory });
        };
        //register a singleton
        Injector.prototype.RegisterInstance = function (key, value) {
            this.RegisterOptions({ Key: key, Instance: value });
        };
        //register an init callback
        //this should probably have a different signature, because it will never return anything, just initialize stuff most likely
        Injector.prototype.RegisterInit = function (options) {
            //setup key value, can be null
            if (!options.Key) {
                options.Key = {};
            }
            this.RegisterOptions(options);
            this.InitDefinitions.push(options.Key);
        };
        Injector.prototype.GetExistingResolution = function (key) {
            var _key = this.getKey(key);
            var res = this.getResolution(_key);
            var value;
            if (res) {
                value = res.GetInstance();
            }
            return value;
        };
        Injector.prototype.ResolveFromExplicitRegistration = function (key) {
            var _key = this.getKey(key);
            var value;
            var reg = this.GetRegistration(_key);
            if (reg) {
                var res = this.CreateFromRegistration(reg);
                this.Resolutions[_key] = res;
                value = res.GetInstance();
            }
            return value;
        };
        Injector.prototype.ResolveFromGlobal = function (key) {
            var _key = this.getKey(key);
            var value;
            value = global[_key];
            if (value !== undefined) {
                this.Resolutions[_key] = new Resolution(function () { return value; });
            }
            return value;
        };
        //attempt to auto register a type if the key is a type
        Injector.prototype.ResolveFromDependentType = function (key) {
            var value;
            if (typeof key === 'function') {
                //create a new registration
                var dep = this.GetDependenciesFromType(key);
                this.RegisterOptions({ Key: key, Factory: key, Dependencies: dep });
                value = this.ResolveFromExplicitRegistration(key);
            }
            return value;
        };
        Injector.prototype.GetDependenciesFromType = function (key) {
            if (typeof key === 'function') {
                // it is a function
                if (typeof key.inject === 'function') {
                    //we have auto dependencies
                    return key.inject();
                }
            }
            return null;
        };
        Injector.prototype.Resolve = function (key) {
            this.EnsureInitialized();
            this.CheckResolveLoop(key);
            this.BuildStack.push(key);
            try {
                var value;
                //no overrides
                value = this.GetExistingResolution(key);
                if (!value) {
                    value = this.ResolveFromExplicitRegistration(key);
                }
                if (!value) {
                    value = this.ResolveFromGlobal(key);
                }
                if (!value) {
                    value = this.ResolveFromDependentType(key);
                }
            }
            finally {
                this.BuildStack.pop();
            }
            return value;
        };
        Injector.prototype.ChildScope = function () {
            return new Injector(this);
        };
        return Injector;
    }());
    JSI.Injector = Injector;
    var Util = /** @class */ (function () {
        function Util() {
        }
        Util.Extend = function (target, source) {
            for (var prop in source) {
                target[prop] = source[prop];
            }
        };
        return Util;
    }());
    var Registration = /** @class */ (function () {
        function Registration(options) {
            Util.Extend(this, options);
        }
        return Registration;
    }());
    JSI.Registration = Registration;
    ///currently just returns the one object, eventually will support lifecycle management i think
    var Resolution = /** @class */ (function () {
        function Resolution(factory) {
            this.factory = factory;
        }
        Resolution.prototype.GetInstance = function () {
            return this.factory();
        };
        return Resolution;
    }());
    var UniqueIdGenerator = /** @class */ (function () {
        function UniqueIdGenerator() {
        }
        UniqueIdGenerator.UniqueId = function (prefix) {
            var idx = UniqueIdGenerator.index++;
            return prefix + idx;
        };
        UniqueIdGenerator.index = 1;
        return UniqueIdGenerator;
    }());
    JSI.UniqueIdGenerator = UniqueIdGenerator;
    //lifecycle manager that maintains a singleton, which is the default behavior anyway
    var SingletonLifetimeManager = /** @class */ (function () {
        function SingletonLifetimeManager() {
        }
        SingletonLifetimeManager.prototype.GetFactory = function (factory) {
            var instance = factory();
            return function () { return instance; };
        };
        return SingletonLifetimeManager;
    }());
    JSI.SingletonLifetimeManager = SingletonLifetimeManager;
    //provides a new object on each request
    var PerRequestLifetimeManager = /** @class */ (function () {
        function PerRequestLifetimeManager() {
        }
        PerRequestLifetimeManager.prototype.GetFactory = function (factory) {
            return factory;
        };
        return PerRequestLifetimeManager;
    }());
    JSI.PerRequestLifetimeManager = PerRequestLifetimeManager;
})(JSI || (JSI = {}));
jsi = new JSI.Injector();
//# sourceMappingURL=jsi.js.map