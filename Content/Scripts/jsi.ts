var global = this;

module JSI {
    export class Injector {

        constructor(public Parent: Injector = null) {
        }

        private initialized: boolean;

        private getKey(providedKey: any): string {
            if (typeof providedKey === 'function' || typeof providedKey === 'object') {
                var objectIdKey = '__ObjectID';
                if (providedKey[objectIdKey] === undefined) {
                    providedKey[objectIdKey] = UniqueIdGenerator.UniqueId('__ObjectID');
                }
                return providedKey[objectIdKey] as string; 
            }
            return providedKey.toString();
        }

        //pulls resolution off of our resolutions, or some other scope object
        private getResolution(key: any, scope: any = null): Resolution {
            scope = scope || this.Resolutions;
            if (scope[key]) {
                var value = <Resolution>scope[key];
                return value;
            }
            return undefined;
        }
        //resolve an array of keys
        private resolveDependencies(dependencies: any[]) {
            dependencies = dependencies || [];
            var values: any[] = [];
            dependencies.forEach((key) => {
                var value = this.Resolve(key);
                values.push(value);
            });
            return values;

        } 


        public initialize(init: any) {
            var keys = Object.keys(init);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                var value = init[key];
                this.RegisterInstance(key, value);
            }
        }

        //create an object from the registration
        private CreateFromRegistration(registration: Registration): Resolution {
            var factory;
            if (registration.Instance) {
                var instance = registration.Instance;
                factory = () => instance;
            } else {
                var dependencyKeys = registration.Dependencies;
                if (!dependencyKeys) {
                    dependencyKeys = this.GetDependenciesFromType(registration.Factory);
                }
                var dependencyValues = this.resolveDependencies(dependencyKeys);

                var factory = this.CreateFromFactoryMethod.bind(this, registration.Factory, dependencyValues);

                var lm = registration.LifetimeManager || new SingletonLifetimeManager();
                if (lm) {
                    //create a resolution 
                    factory = lm.GetFactory(factory);
                }
            }
            return new Resolution(factory);

        }

        //invokes the factory method, either using the return value or *this* reference constructor style
        private CreateFromFactoryMethod(factory: any, dependencyValues: any[]): any {
            if (Util.isConstructor(factory)) {
                return new factory(...dependencyValues);
            } else {
                 var value = undefined;
                    if (factory.prototype)
                        value = Object.create(factory.prototype);
                    var returnValue = factory.apply(value, dependencyValues);
                    value = returnValue || value;
            }
            return value;
        }

        //get definition for the provided key, from local or parent scope
        public GetRegistration(key): Registration {
            var k = this.getKey(key);
            if (this.Registrations[k]) {
                return this.Registrations[k];
            }
            if (this.Parent) {
                return this.Parent.GetRegistration(k);
            }
            return null;
        }




        private EnsureInitialized() {
            if (!this.initialized) {
                this.initialized = true;
                this.RegistrationCallbacks.forEach((act) => act());
                this.InitDefinitions.forEach((key) => this.Resolve(key));
            }
        }

        private CheckResolveLoop(key: any): void {
            if (this.BuildStack.indexOf(key) > -1) {
                //unsure of the formatting here, just want to have consise logs, if we are resolving types, just write the type name
                var current = key.name ? 'TYPE: ' + key.name : key;
                var prev = this.BuildStack.pop();
                prev = prev.name ? 'TYPE: ' + prev.name : prev;
                throw new Error('require loop detected building ' + current + ' for ' + prev);
            }
        }

        //private Registrations : Array<Registration> = new Array<Registration>(); 
        //private Resolutions : Array<Resolution> =new Array<Resolution>();    //Items that have been resolved by this Injector
        private Registrations: any = {};
        private Resolutions: any = {};
        private BuildStack: any[] = new Array<any>(); //stack a items being resolved
        private InitDefinitions: any[] = new Array<any>(); //definitions that need to be resolved at startup
        //callbacks used to register types  These get called on first require, because definie init is processed
        //last min chance to register types
        private RegistrationCallbacks: IRegistrationCallback[] = new Array<IRegistrationCallback>();
        //setup a registration
        RegisterOptions(options: RegisterOptions): Registration {
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
            if (this.Registrations[options.Key] !== undefined) {
                throw new Error("key aready defined");
            }
            this.Registrations[reg.Key] = reg;
            return reg;

        }

        RegisterCallback(callback: IRegistrationCallback) {
            if (this.initialized) {
                throw new Error('Registration Callback added when injector is already initialized');
            }
            this.RegistrationCallbacks.push(callback);
        }

        //old fashion register
        Register(key: any, dependencies: any[] = null, factory: any = null): Registration {
            return this.RegisterOptions({ Key: key, Dependencies: dependencies, Factory: factory });
        }

        //register a singleton
        RegisterInstance(key: any, value: any): void {
            this.RegisterOptions({ Key: key, Instance: value });
        }
        //register an init callback
        //this should probably have a different signature, because it will never return anything, just initialize stuff most likely
        RegisterInit(options: RegisterOptions): void {
            //setup key value, can be null
            if (!options.Key) {
                options.Key = {};
            }
            this.RegisterOptions(options);
            this.InitDefinitions.push(options.Key);
        }


        private GetExistingResolution<T>(key: any): T {
            var _key = this.getKey(key);
            var res = this.getResolution(_key);
            var value: T;
            if (res) {
                value = <T>res.GetInstance();
            }
            return value;
        }

        private ResolveFromExplicitRegistration<T>(key: any): T {
            var _key = this.getKey(key);
            var value: T;
            var reg = this.GetRegistration(_key);
            if (reg) {
                var res = this.CreateFromRegistration(reg);
                this.Resolutions[_key] = res;
                value = <T>res.GetInstance();
            }
            return value;
        }
        private ResolveFromGlobal<T>(key: any) {
            var _key = this.getKey(key);
            var value: T;
            value = global[_key];
            if (value != undefined) {
                this.Resolutions[_key] = new Resolution(() => value);
            }
            return value;
        }
        //attempt to auto register a type if the key is a type
        private ResolveFromDependentType<T>(key: any): T {
            var value: T;
            if (typeof key === 'function') {
                //create a new registration
                var dep = this.GetDependenciesFromType(key);
                this.RegisterOptions({ Key: key, Factory: key, Dependencies: dep });
                value = this.ResolveFromExplicitRegistration<T>(key);
            }
            return value;
        }

        private GetDependenciesFromType(key: any) {
            if (typeof key === 'function') {
                // it is a function
                if (typeof key.inject === 'function') {
                    //we have auto dependencies
                    return key.inject();
                }
            }
            return null;
        }

        Resolve<T>(key: any): T {
            this.EnsureInitialized();

            this.CheckResolveLoop(key);

            this.BuildStack.push(key);
            try {
                var value: any;

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
        }

        ChildScope(): Injector {
            return new Injector(this);
        }
    }

    export interface RegisterOptions {
        Key?: any;
        Factory?: any;
        Instance?: any;
        Dependencies?: any[];
        LifetimeManager?: ILifetimeManager;
    }

    class Util {
        static Extend(target: any, source: any) {
            for (var prop in source) {
                target[prop] = source[prop];
            }
        }
        static isConstructor(obj:any) {
            return !!obj.prototype && !!obj.prototype.constructor.name;
        }
    }

    export class Registration {
        constructor(options: RegisterOptions) {
            Util.Extend(this, options);
        }
        Key: any;
        Factory: FactoryMethod;
        Instance: any;
        Dependencies: any[];
        LifetimeManager: ILifetimeManager;
    }

    ///currently just returns the one object, eventually will support lifecycle management i think
    class Resolution {
        private factory: FactoryMethod;
        constructor(factory: FactoryMethod) {
            this.factory = factory;
        }
        GetInstance(): any {
            return this.factory();
        }
    }

    export interface FactoryMethod {
        (...params: any[]): any;
    }

    export interface IRegistrationCallback {
        (): void;
    }

    export interface ILifetimeManager {
        GetFactory(factory: any): FactoryMethod;
    }

    export class UniqueIdGenerator {
        private static index: number = 1;
        static UniqueId(prefix: string): string {
            var idx = UniqueIdGenerator.index++;
            return prefix + idx;
        }
    }




    //lifecycle manager that maintains a singleton, which is the default behavior anyway
    export class SingletonLifetimeManager implements ILifetimeManager {
        GetFactory(factory: any) {
            var instance = factory();
            return () => instance;
        }
    }
    //provides a new object on each request
    export class PerRequestLifetimeManager implements ILifetimeManager {
        GetFactory(factory: any) {
            return factory;
        }
    }
}


declare var jsi: JSI.Injector;
jsi = new JSI.Injector();