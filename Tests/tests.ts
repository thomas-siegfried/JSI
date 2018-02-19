module JSITests {
    export class MyClass {
        name: string = 'myclass';
    }

    export class InjClass {
        constructor(public cls: MyClass) {
        }
        static inject = function () { return [MyClass]; };
    }

    export class JQueryTester {
        constructor(public jq: any) {
        }
    }
}

//either the window, or empty global for testing.
var global = this;
describe('jsi', () => {
    it('exists', () => {
        expect(JSI).toBeDefined('JSI Namespace not defined');
        expect(jsi).toBeDefined('jsi global object not defined');
    });

    it('allows simple registration', () => {
        var i = jsi.ChildScope();
        i.Register('simple', [], () => {
            var s = new JSITests.MyClass();
            s.name = "Fred";
            return s;
        });
        var obj: JSITests.MyClass = <JSITests.MyClass>i.Resolve('simple');
        expect(obj.name).toBe('Fred');
    });

    it('allows registration by type', () => {
        var i = jsi.ChildScope();
        i.Register(JSITests.MyClass, [], JSITests.MyClass);
        var obj = <JSITests.MyClass>i.Resolve(JSITests.MyClass);
        expect(obj.name).toBe('myclass');
    });

    it('allows multiple simple object registrations that do not squish each other', () => {
        //objects can be keys for the registration
        var i = jsi.ChildScope();
        var x = {};
        var y = {};
        i.Register(x, [], () => x);
        i.Register(y, [], () => y);
        var x2 = i.Resolve(x);
        var y2 = i.Resolve(y);
        expect(x2).toBe(x);
        expect(y2).toBe(y);
    });

    it('allows a type to declare dependencies via a static inject property', () => {
        var i = jsi.ChildScope();
        i.Register(JSITests.InjClass);
        i.Register(JSITests.MyClass);
        var injClass = <JSITests.InjClass>i.Resolve(JSITests.InjClass);
        expect(injClass.cls.name).toBe('myclass');
    });

    it('allows resolution of unregistered types', () => {
        var i = jsi.ChildScope();
        var mc = i.Resolve(JSITests.MyClass);
        expect(mc).toBeDefined();
    });

    it('allows resolution of global variables', () => {
        var i = jsi.ChildScope();
        var fakeJQuery = {};
        global['$'] = fakeJQuery;
        var $ = i.Resolve('$');
        expect($).toBe(fakeJQuery);
    });

    it('Does not attempt to instantiate objects resolved from global with string keys', () => {
        //items resolved from global with string keys are not instantiated.  Prevents injection from trying to object.create something like $ or _.
        var i = jsi.ChildScope();
        var myfun = () => {
            return 0;
        };
        global.myfun = myfun;
        var resolved = i.Resolve('myfun');
        //resolve the function, not the result of the function
        expect(resolved).not.toBe(0);
    });

    it('allows resolution of globals as a dependency', () => {

        var i = jsi.ChildScope();
        var fakeJQuery = {};
        global['$'] = fakeJQuery;
        i.Register(JSITests.JQueryTester, ['$']);
        var jqt = i.Resolve(JSITests.JQueryTester) as JSITests.JQueryTester;
        expect(jqt.jq).toBe(fakeJQuery);
    });

    it('prevents re-registering the same value', () => {
        var i = jsi.ChildScope();
        i.Register('test',[], () => 'some value' );
        expect(() => { i.Register('test', [], () => 'some other value') }).toThrow();
    });

    it('allows re-registering in a child scope', () => {
        var i = jsi.ChildScope();
        i.Register('test', [], () => 'some value');
        var ii = i.ChildScope();
        ii.Register('test', [], () => 'some other value');
    });

    it('provides singleton instances by default', () => {
        var i = jsi.ChildScope();
        
        i.Register('obj',[], () => {
            return new JSITests.MyClass();
        });

        var obj1 = i.Resolve('obj');
        var obj2 = i.Resolve('obj');
        expect(obj1).toBe(obj2);
    });

    it('resolves new objects in different child scopes', () => {
        var i = jsi.ChildScope();

        i.Register('obj', [], () => {
            return new JSITests.MyClass();
        });

        var ii = i.ChildScope();
        var obj1 = ii.Resolve('obj');
        var iii = i.ChildScope();
        var obj2 = iii.Resolve('obj');
        expect(obj1).not.toBe(obj2);
    });

    it('allows explicit per call resolution', () => {
        var i = jsi.ChildScope(); 
        i.RegisterOptions({
            Key: 'obj',
            Dependencies: [],
            Factory: () => { return new JSITests.MyClass(); },
            LifetimeManager:new JSI.PerRequestLifetimeManager()
        });

        var obj1 = i.Resolve('obj');
        var obj2 = i.Resolve('obj');
        expect(obj1).not.toBe(obj2);
    });
});

