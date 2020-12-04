const path = require('path')
const fs = require('fs')
const vm = require('vm')

function tryModuleLoad (module) {
  // 获取文件后缀名称
  let ext = path.extname(module.id)

  // 加载相关模块
  Module.extensions[ext](module)
}

function req (id) {
  // 通过相对路径获取绝对路径
  let filename = Module._resolveFilename(id)
  let cache = Module._cache[filename]

  if (cache) {
    return cache.exports
  }

  let module = new Module(filename)
  Module._cache[filename] = module

  tryModuleLoad(module)

  return module.exports
}

function Module (id) {
  // id为文件的绝对路径
  this.id = id
  this.exports = {}
}
Module.extensions = {}
Module._cache = {}
Module.extensions[".js"] = function (module) {
  let wrapper = [
    '(function (exports, require, module, __dirname, __filename) {\r\n',
    '\r\n})'
  ];

  // 1) 读取文件内容
  let script = fs.readFileSync(module.id, 'utf8')
  // 2) 内容拼接
  let content = wrapper[0] + script + wrapper[1]
  // 3) 创建沙盒环境, 返回js函数
  let fn = vm.runInThisContext(content)

  let __dirname = path.__dirname(module.id)

  // 让函数执行
  fn.call(module.exports, module.exports, req, module, __dirname, module.id)
}

Module.extensions['.json'] = function (module) { 
  let script = fs.readFileSync(module.id, 'utf8')
  module.exports = JSON.parse(script)
}

Module._resolveFilename = function (id) {

  // 将相对路径转化称绝对路径
  let absPath = path.resolve(id)
  // 先判断文件是否存在如果存在就不要增加了
  if (fs.existsSync(absPath)) {
    return absPath
  }

  // 尝试添加文件后缀 .js .json
  let extenisons = Object.keys(Module.extensions);

  for (let i = 0; i < extenisons.length; i++) {
    let ext = extenisons[i]

    // 判断路径是否存在
    let currentPath = absPath + ext;
    let exits = fs.existsSync(currentPath)
    if (exits) {
      return currentPath
    }
  }

  throw new Error('文件不存在')
}




let str = req('./b')

console.log(str.name)