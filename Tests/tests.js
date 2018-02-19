var JSITests;
(function (JSITests) {
    var MyClass = /** @class */ (function () {
        function MyClass() {
            this.name = 'myclass';
        }
        return MyClass;
    }());
    JSITests.MyClass = MyClass;
    var InjClass = /** @class */ (function () {
        function InjClass(cls) {
            this.cls = cls;
        }
        InjClass.inject = function () { return [MyClass]; };
        return InjClass;
    }());
    JSITests.InjClass = InjClass;
    var JQueryTester = /** @class */ (function () {
        function JQueryTester(jq) {
            this.jq = jq;
        }
        return JQueryTester;
    }());
    JSITests.JQueryTester = JQueryTester;
})(JSITests || (JSITests = {}));
//either the window, or empty global for testing.
var global = this;
describe('jsi', function () {
    it('exists', function () {
        expect(JSI).toBeDefined('JSI Namespace not defined');
        expect(jsi).toBeDefined('jsi global object not defined');
    });
    it('allows simple registration', function () {
        var i = jsi.ChildScope();
        i.Register('simple', [], function () {
            var s = new JSITests.MyClass();
            s.name = "Fred";
            return s;
        });
        var obj = i.Resolve('simple');
        expect(obj.name).toBe('Fred');
    });
    it('allows registration by type', function () {
        var i = jsi.ChildScope();
        i.Register(JSITests.MyClass, [], JSITests.MyClass);
        var obj = i.Resolve(JSITests.MyClass);
        expect(obj.name).toBe('myclass');
    });
    it('allows multiple simple object registrations that do not squish each other', function () {
        var i = jsi.ChildScope();
        var x = {};
        var y = {};
        i.Register(x, [], function () { return x; });
        i.Register(y, [], function () { return y; });
        var x2 = i.Resolve(x);
        var y2 = i.Resolve(y);
        expect(x2).toBe(x);
        expect(y2).toBe(y);
    });
    it('allows a type to declare dependencies via a static inject property', function () {
        var i = jsi.ChildScope();
        i.Register(JSITests.InjClass);
        i.Register(JSITests.MyClass);
        var injClass = i.Resolve(JSITests.InjClass);
        expect(injClass.cls.name).toBe('myclass');
    });
    it('allows resolution of unregistered types', function () {
        var i = jsi.ChildScope();
        var mc = i.Resolve(JSITests.MyClass);
        expect(mc).toBeDefined();
    });
    it('allows resolution of global variables', function () {
        var i = jsi.ChildScope();
        var fakeJQuery = {};
        global['$'] = fakeJQuery;
        var $ = i.Resolve('$');
        expect($).toBe(fakeJQuery);
    });
    it('allows resolution of globals as a dependency', function () {
        var i = jsi.ChildScope();
        var fakeJQuery = {};
        global['$'] = fakeJQuery;
        i.Register(JSITests.JQueryTester, ['$']);
        var jqt = i.Resolve(JSITests.JQueryTester);
        expect(jqt.jq).toBe(fakeJQuery);
    });
});
//# sourceMappingURL=tests.js.map