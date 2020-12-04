# 手写CommonJs中的require函数

## 什么是 CommonJS ？

每一个文件就是一个模块，拥有自己独立的作用域，变量，以及方法等，对其他的模块都不可见。CommonJS规范规定：每个模块内部，module变量代表当前模块。这个变量是一个对象，它的exports属性（即module.exports）是对外的接口。加载某个模块，其实是加载该模块的module.exports属性。require方法用于加载模块。

## CommonJS模块的特点：

```
所有代码都运行在模块作用域，不会污染全局作用域。
```

- 模块可以多次加载，但是只会在第一次加载时运行一次，然后运行结果就被缓存了，以后再加载，就直接读取缓存结果。要想让模块再次运行，必须清除缓存。

- 模块加载的顺序，按照其在代码中出现的顺序。

## 如何使用

假设我们现在有个a.js文件，我们要在main.js 中使用a.js的一些方法和变量，运行环境是nodejs。这样我们就可以使用CommonJS规范，让a文件导出方法/变量。然后使用require函数引入变量/函数。

示例: 

```js
// a.js
module.exports = '这是a.js的变量'; // 导出一个变量/方法/对象都可以
```

```js
//main.js
let str = require('./a'); // 这里如果导入a.js，那么他会自动按照预定顺序帮你添加后缀
console.log(str); // 输出：'这是a.js的变量'
```

## 手写一个require函数

导入一个符合CommonJS规范的JS文件。支持自动添加文件后缀（暂时支持JS和JSON文件） 现在就开始吧！

### 1. 定义req方法

我们先自定义一个req方法，和全局的require函数隔离开。这个req方法，接受一个名为ID的参数，也就是要加载的文件路径。

```js
// main.js
function req(id) {}
let a = req('./a')
console.log(a)
```

### 2. 新建一个Module类

```js
function Module(id) {
    this.id = id; // 当前模块的文件路径
    this.exports = {} // 当前模块导出的结果，默认为空
}
```

### 3. 获取文件绝对路径

我们在Module类上添加一个叫做`“_resolveFilename”`的方法，用于解析用户传进去的文件路径，获取一个绝对路径。

```js
// 将一个相对路径 转化成绝对路径
Module._resolveFilename = function (id) {}
```

继续添加一个 “extennsions” 的属性，这个属性是一个对象。key是文件扩展名，value就是扩展名对应的不同文件的处理方法。

```js
Module.extenstioins = {}
Module.extensions['.js'] = function (module) {}
Module.extensions['.json'] = function (module) {}
```

接着，我们导入nodejs原生的“path”模块和“fs”模块，方便我们获取文件绝对路径和文件操作。

我们处理一下 `Module._resolveFilename` 这个方法，让他可以正常工作。

```js
Module._resolveFilename = function (id) {
    // 将相对路径转化成绝对路径
    let absPath = path.resolve(id);

    //  先判断文件是否存在如果存在了就不要增加了 
    if(fs.existsSync(absPath)){
        return absPath;
    }
    // 去尝试添加文件后缀 .js .json 
    let extenisons = Object.keys(Module.extensions);
    for (let i = 0; i < extenisons.length; i++) {
        let ext = extenisons[i];
        // 判断路径是否存在
        let currentPath = absPath + ext; // 获取拼接后的路径
        let exits = fs.existsSync(currentPath); // 判断是否存在
        if(exits){
            return currentPath
        }
    }
    throw new Error('文件不存在')
}
```
在这里，我们支持接受一个名id的参数，这个参数将是用户传来的路径。

首先我们先使用 path.resolve()获取到文件绝对路径。接着用 fs.existsSync 判断文件是否存在。如果没有存在，我们就尝试添加文件后缀。

我们会去遍历现在支持的文件扩展对象，尝试拼接路径。如果拼接后文件存在，返回文件路径。不存在抛出异常。

这样我们在req方法内，就可以获取到完整的文件路径：

```js
function req(id){
    // 通过相对路径获取绝对路径
    let filename = Module._resolveFilename(id);
}
```

### 4. 加载模块 — JS的实现

这里就是我们的重头戏，加载common.js模块。

首先 new 一个Module实例。传入一个文件路径，然后返回一个新的module实例。

接着定义一个 tryModuleLoad 函数，传入我们新建立的module实例。

```js
function tryModuleLoad(module) { // 尝试加载模块
   let ext = path.extname(module.id);
   Module.extensions[ext](module)
}
function req(id){
    // 通过相对路径获取绝对路径
    let filename = Module._resolveFilename(id);
    let module = new Module(filename); // new 一个新模块
    tryModuleLoad(module); 
}
```

tryModuleLoad 函数 获取到module后，会使用 path.extname 函数获取文件扩展名，接着按照不同扩展名交给不同的函数分别处理。

## 处理js文件加载.

### 第一步，传入一个module对象实例。

使用module对象中的id属性，获取文件绝对路径。拿到文件绝对路径后，使用fs模块读取文件内容。读取编码是utf8。

### 第二步，伪造一个自执行函数。

这里先新建一个wrapper 数组。数组的第0项是自执行函数开头，最后一项是结尾。

```js
let wrapper = [
    '(function (exports, require, module, __dirname, __filename) {\r\n',
    '\r\n})'
];
```

这个自执行函数需要传入5个参数：exports对象，require函数，module对象，dirname路径，fileame文件名。

我们将获取到的要加载文件的内容，和自执行函数模版拼接，组装成一个完整的可执行js文本：

```js
Module.extensions['.js'] = function (module) {
    // 1) 读取
    let script = fs.readFileSync(module.id, 'utf8');
    // 2) 内容拼接
    let content = wrapper[0] + script + wrapper[1];
}
```

### 第三步: 创建沙箱执行环境

这里我们就要用到nodejs中的 “vm” 模块了。这个模块可以创建一个nodejs的虚拟机，提供一个独立的沙箱运行环境。

我们使用vm模块的 runInThisContext函数，他可以建立一个有全局global属性的沙盒。用法是传入一个js文本内容。我们将刚才拼接的文本内容传入，返回一个fn函数：

```js
const vm = require('vm');

Module.extensions['.js'] = function (module) {
    // 1) 读取
    let script = fs.readFileSync(module.id, 'utf8');
    // 2) 内容拼接
    let content = wrapper[0] + script + wrapper[1];
    // 3）创建沙盒环境，返回js函数
    let fn = vm.runInThisContext(content); 
}
```

第四步：执行沙箱环境，获得导出对象。

因为我们上面有需要文件目录路径，所以我们先获取一下目录路径。这里使用path模块的dirname 方法。

接着我们使用call方法，传入参数，立即执行。

call 方法的第一个参数是函数内部的this对象，其余参数都是函数所需要的参数。

```js
module.extensions['.js'] = function (module) {
    // 1) 读取
    let script = fs.readFileSync(module.id, 'utf8');
    // 2) 增加函数 还是一个字符串
    let content = wrapper[0] + script + wrapper[1];
    // 3) 让这个字符串函数执行 (node里api)
    let fn = vm.runInThisContext(content); // 这里就会返回一个js函数
    let __dirname = path.dirname(module.id);
    // 让函数执行
    fn.call(module.exports, module.exports, req, module, __dirname, module.id)
}
```
这样，我们传入module对象，接着内部会将要导出的值挂在到module的export属性上。

### 第五步：返回导出值

由于我们的处理函数是非纯函数，所以直接返回module实例的export对象就ok。

```js
function req(id){ // 没有异步的api方法
    // 通过相对路径获取绝对路径
    let filename = Module._resolveFilename(id);
    tryModuleLoad(module); // module.exports = {}
    return module.exports;
}
```

这样，我们就实现了一个简单的require函数。

```js
let str = req('./a');
// str = req('./a');
console.log(str);
// a.js
module.exports = "这是a.js文件"
```

### 5. 加载模块 —— JSON文件的实现

json文件的实现就比较简单了。使用fs读取json文件内容，然后用JSON.parse转为js对象就ok。

```js
Module.extensions['.json'] = function (module) {
    let script = fs.readFileSync(module.id, 'utf8');
    module.exports = JSON.parse(script)
}
```

### 6. 优化

文章初，我们有写：commonjs会将我们要加载的模块缓存。等我们再次读取时，就去缓存中读取我们的模块，而不是再次调用fs和vm模块获得导出内容。

我们在Module对象上新建一个_cache属性。这个属性是一个对象，key是文件名，value是文件导出的内容缓存。

在我们加载模块时，首先先去_cache属性上找有没有缓存过。如果有，直接返回缓存内容。如果没有，尝试获取导出内容，并挂在到缓存对象上。

```js
Module._cache = {}

function req(id){
    // 通过相对路径获取绝对路径
    let filename = Module._resolveFilename(id);
    let cache = Module._cache[filename];

    if(cache){ // 如果有缓存，直接将模块的结果返回
        return cache.exports
    }
    let module = new Module(filename); // 创建了一个模块实例
    Module._cache[filename] = module // 输入进缓存对象内

    // 加载相关模块 （就是给这个模块的exports赋值）
    tryModuleLoad(module); // module.exports = {}
    return module.exports;
}
```

## 总结

让我们回顾一下，require的实现流程：

- 拿到要加载的文件绝对路径。没有后缀的尝试添加后缀
- 尝试从缓存中读取导出内容。如果缓存有，返回缓存内容。没有，下一步处理
- 新建一个模块实例，并输入进缓存对象
- 尝试加载模块
- 根据文件类型，分类处理
- 如果是js文件，读取到文件内容，拼接自执行函数文本，用vm模块创建沙箱实例加载函数文本，获得导出内容，返回内容
- 如果是json文件，读取到文件内容，用JSON.parse 函数转成js对象，返回内容 获取导出返回值。