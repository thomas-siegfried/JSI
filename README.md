# JSI - The JavaScript Injector
A simple dependency injection utility for JavaScript.

##  Usage
### Basic Registration
Register a constructor function using a key, a list of dependencies, and a factory method.  Dependencies are resolved and injected into the constructor function.  
`jsi.Register('key',[],()=>{ return {}};`
### Resolve an object
Resolve a registered object by providing a key.  The global injector will maintain a singleton reference by default.
`var obj = jsi.Resolve('key');`
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
