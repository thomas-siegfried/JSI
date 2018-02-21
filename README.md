# JSI - The JavaScript Injector
A simple dependency injection utility for JavaScript.
## Overview
JSI is a dependency injection utility for JavaScript using Register/Resolve pattern similar to Unity. JSI does not participate in bundling or script loading. Lifetime management is supported, components can be registered as singleton, per-resolve, or custom lifetime. Hierarchical injectors facilitate unit testing. JSI has no external dependencies.
##  Usage
### Basic Registration
Register a constructor function using a key, a list of dependencies, and a factory method.  Dependencies are resolved and injected into the constructor function.  
```javascript
jsi.Register('key',[],()=>{ return {}};
```
### Resolve an object
Resolve a registered object by providing a key.  The global injector will maintain a singleton reference by default.
```javascript
var obj = jsi.Resolve('key');
```
### Declare Dependencies
Any dependencies declared in a registration are resolved and injected into the constructor function of the registration.
```javascript 
jsi.Register('myService',[],()=>{
	return { 
	   ServiceMethod:()=>{}
	}
}
jsi.Register('client',['myService'],(svc)=>{
	 this.service=svc;
	 this.callServiceMethod =()=>{
		 return svc.ServiceMethod();
	}
}
```
### Registrations can be constructor functions
```javascript
function MyService(){
	this.Name="Service Name";
}
function MyClass(svc){
	this.ServiceName=svc.Name;
}
// Key is assumed to by factory method, if no factory method is provided
jsi.Register(MyService,[]);
jsi.Register(MyClass,[MyService]);
var cls = jsi.Resolve(MyClass);

```

### Registrations can of course also be classes.  Example in typescript.
```typescript
class MyService{
	Name:string;
	constructor(){
		this.Name='Service Name';
	}
}
class MyClass{
	ServiceName:string;
	constructor(svc:MyService){
		this.ServiceName=svc.Name;
	}
}
jsi.Register(MyService,[]);
jsi.Register(MyClass,[MyService]);
var cls = jsi.Resolve<MyClass>(MyClass);
```
## Implicit Registration
### Dependencies can be resolved from global scope if not registered explicitly
Injector will attempt to resolve dependencies from global scope if they are not found via explicit registration.  If a dependency is a function, the injector will attempt to instantiate an object (via new or object.create()). 
```typescript
class MyClass{
	constructor($:any){
		//$(.selector)....
	}
}
//will resolve jquery from global scope (if it exists)
jsi.Register(MyClass,['$'])
```
### We can also resolve items from global scope if not registered
```typescript
class MyService{
	Name:string;
	constructor(){
		this.Name='Service Name';
	}
}
// do not requre explicit registration if no dependencies required.
jsi.Resolve(MyService);
```
### A type can specify its own dependencies
A class or constructor function can specify dependencies via by convention by providing a method named 'inject', which returns an array of dependencies in the same format expected by the Register method.
```typescript
class MyClass{
	ServiceName:string;
	constructor(svc:MyService){
		this.ServiceName=svc.Name;
	}
	static inject=()=>{return [MyService];}
}
```
## Lifetime Management
Any component registered with a JSI injector is a singleton by default.  The first time the component is Resolved, or created as a dependency of another component, the instance is cached.  Any further resolutions of that component will return the same object.
```typescript
class MyClass{}
jsi.Register(MyClass,[]);
var obj = jsi.Resolve<MyClass>(MyClass);
var obj2 = jsi.Resolve<MyClass>(MyClass);
//obj===obj2
```
### Per Call Lifetime
A registration can specify a different lifetime by instead calling RegisterOptions() which accepts additional parameters including an ILifetimeManager.  JSI includes two implementations of ILifetimeManager; SingletonLifetimeManager (the default) maintains a single instance across all resolutions, and PerRequestLifetimeManager, which creates a new instance each time a component is requested. 
```typescript
class MyPerRequestClass{}
jsi.RegisterOptions({
	Key:MyPerRequestClass,
	LifetimeManager:new JSI.PerRequestLifetimeManager()
});
let obj1=jsi.Resolve<MyPerRequestClass>(MyPerRequestClass);
let obj2=jsi.Resolve<MyPerRequestClass>(MyPerRequestClass);
//obj1!==obj2
```
## Hierarchical Injectors
The core of the JSI framework is the Injector class.  When components are registered with an Injector, they are stored in a registration list.  When a component is resolved, a resolution object is created from the registration and cached in the injector.  The resolution object is then used to create all future instances of the object.  A single Injector is created on the global namespace as 'jsi', and is known as the root injector.   Normally all interaction is done with the root injector, however in some cases it is useful to create child injectors
```typescript
var childInjector = jsi.ChildScope();
```
The child injector maintains its own list of registrations and resolutions.  When an attempt is made to resolve a component on a child injector, the child searches its own list of registrations, the passes the request to its parent if a local registration is not found.  If a registration is found, a resolution is created on the child injector, even if the registration was found on the parent.  This is useful in unit testing situations where we want to start each test with a clean slate.
```typescript
class MyClass(){}
jsi.Register('key',[],MyClass);

//some jasmine tests
describe('MyClass',()=>{
	it('has behavior a',()=>{
		var scope = jsi.ChildScope();
		var obj=scope.Resolve<MyClass>('key');
		//object 'obj' is cached on the child scope
		//after test completes, this scope disappears along with all resolved objects
	});
	it('has behavior b',()=>{
		//create a new child scope
		var scope = jsi.ChildScope();
		//this object, and any dependencies will be created fresh
		var obj=scope.Resolve<MyClass>('key');
	});
});
```
