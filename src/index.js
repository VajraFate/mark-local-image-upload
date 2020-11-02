/*
 * @Github: https://github.com/OBKoro1/markdown-img-down-site-change
 * @Author: OBKoro1
 * @Created_time: 2019-05-28 17:21:41
 * @LastEditors: OBKoro1
 * @LastEditTime: 2019-07-11 20:24:14
 * @Description: 查找指定文件夹的所有markdown文件。
 * 根据参数找出要所有要替换的图片，下载所有图片，替换图片的地址。
 */

const util = require('./util')
const fs = require('fs'); // 文件模块
const request = require('request');
const async = require("async");
const path = require('path');
const upLoadImage = require('./request.js');
const pLimit = require('p-limit');

class markdownImageDown {
    /**
     * @param {Object} option 配置项
     * new_image_url: '', // 图片上传的地址
     * add_end: '', // 在图片名字后面添加后缀添加后缀
     * read_markdown_src: './source', // 要查找markdown文件的文件夹地址
     * down_img_src: './markdown_img_src', // 下载项目的地址
     * output_item_data: 'outputDir', // 默认替换后输出的文档
     * filter_item: [], // 过滤某些文件夹 不去查找markdown
     * new_image_url: '', // 图片上传的地址
     * var_number: 0, // url前半部分的变量数量
     * @Created_time: 2019-05-31 14:30:40
     */
    constructor(option = {}) {
        if (!util.checkDataAction('Object', option, 'option必须为对象')) return
        let defaultOption = {
            replace_image_url: 'http://ww1.sinaimg.cn/large/',
            new_image_url: 'https://xxx.com/目录地址/', // 图片上传的地址
            add_end: '', // 在图片名字后面添加后缀添加后缀
            read_markdown_src: './source', // 要查找markdown文件的文件夹地址
            down_img_src: './markdown_img_src', // 图片下载到这个文件夹下面
            output_item_data: 'outputDir', // 默认替换后输出的文档
            var_number: 0, // url前半部分的变量数量
            is_link: true, // 不止匹配![](),链接也匹配 []()
            test: false, // 测试模式：不修改.md
            write_file_time: 3000, // 修改文件的settimeout时间，为拷贝文件留出的时间
            downFileNameCallBack: null, // 处理下载的图片name 返回一个图片name
            filter_item: ['.git'], // 过滤某些文件夹 不去查找markdown
            upload_iamge_url: 'https://xxxx/image/', // image图床地址
        }
        this.imgMap = new Map() // 查找的img
        this.unReplaceFile = [];
        this.option = Object.assign(defaultOption, option) // 配置参数
        this.filePathList = []; // 二维数组 记录要转化的目标全部文件路径
        this.imageLegth = 0; // 记录上传图片数量
        this.init();
    }

    async init () {
        await this.checkDownImg();
        await this.updateOption();
        this.replaceMarkdown();
    }

    deleteFile(path) {
        var files = [];
        if( fs.existsSync(path) ) {
            files = fs.readdirSync(path);
            files.forEach((file,index) => {
                var curPath = path + "/" + file;
                if(fs.statSync(curPath).isDirectory()) {
                    this.deleteFile(curPath);
                } else {
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(path);
            // console.log('删除', path);
        }
};

    // 搜索图片链接 下载图片
    async checkDownImg() {
        if (this.option.output_item_data) {
            // 异步复制
            this.copyNow = true
            this.deleteFile(this.option.output_item_data);
            await this.copyDir(this.option.read_markdown_src, this.option.output_item_data, (err) => {
                console.log('复制文件夹报错：', err)
            });
            // console.log('图片复制完成')
        }
        this.readFile(this.option.output_item_data);
        // this.downImg(;
        // todo: upload Image nad set Map
        // this.uploadImage()
    }
    // 替换图片链接
    replaceMarkdown() {
        let time = 0
        if (this.copyNow) {
            time = this.option.write_file_time
            this.copyNow = false;
        }
        setTimeout(() => {
            // this.readFile(this.option.output_item_data, true)
            this.filePathList.map(file => {
                const url = file.url;
                let data = file.data;
                ['allUrl', 'imgDivUrl'].map(type => {
                    let reg = this.reg(type);
                    const matchImageList = data.match(reg);
                    data = this.replaceMarkdownImageLinkStr(data, url, matchImageList, type);
                });
                // 将文档文本替换后,写入文件
                !this.option.test && fs.writeFile(url, data, 'utf-8', () => {
                    console.log('修改成功', url);
                });
            });
            // console.log('修改图片地址成功');
            // console.log(`一共有这几个没有匹配到文件${this.unReplaceFile.length}`, this.unReplaceFile);
        }, time)
    }
    /**
     * @desc 替换对应str,返回替换后的文档文本
     * @param {*} data 文本数据
     * @param {*} url
     * @param {*} matchImageList
     * @param {*} type
     */
    replaceMarkdownImageLinkStr (data, url, matchImageList, type) {
        // 做的操作：
        // http://ww1.sinaimg.cn/large/aaaaa.jpg，![](https://user-gold-cdn.xitu.io/2019/5/20/16ad3ff354f2dac3?w=2024&h=1240&f=png&s=339262)
        // 变量0：[ '', 'http://ww1.sinaimg.cn/large/', 'aaaaa.jpg' ]
        // 变量3(日期)：['![](', 'https://user-gold-cdn.xitu.io/2019/5/20/', '16ad3ff354f2dac3?w=2024&h=1240&f=png&s=339262)']
        try {
            // let splitArr = regUrl.split(sectionUrlReg)
            // const fileName = this.fileNameFormat(splitArr[2])
            // let replaceUrl = `${this.option.new_image_url}${fileName}`
            // 替换字符串
            // isChange = true
            if (matchImageList) {
                matchImageList.map(link => {
                    const imageUrl = this.getMarkDownUrl(type, link);
                    const sawikiUrl = this.imgMap.get(imageUrl);
                    if (sawikiUrl) {
                        const sawikiLink = `https://sawiki2.nie.netease.com/media/${sawikiUrl}`;
                        // console.log('imageUrl: ', imageUrl, sawikiLink);
                        data = data.replace(imageUrl, sawikiLink);
                    }
                });
            } else {
                this.unReplaceFile.push(url);
                console.log('没有匹配到图片', url);
            }
            return data;
            // console.log('data: ', data);
        } catch (err) {
            throw `请检查new_image_url、var_number的设置：${err}`
        }
    }

    /**
     * @description: 正则匹配整个url或者部分url
     * @param {String} type 'allUrl'：匹配markdown图片
     * @return: reg
     * @Created_time: 2019-06-04 10:32:50
     */
    reg(type) {
        let replaceSlash = (str) => {
            str = str.replace(/\//g, '\\/')
            str = str.replace(/\./g, '\\.')
            return str
        }
        let jointReg = (num) => {
            let str = ``
            if (num > 0) {
                let defineStr = `.*\\/`
                str += defineStr.repeat(num)
                str += `)`
            } else {
                str = `)` // 直接提取url
            }
            return str
        }
        let http = this.option.replace_image_url
        let url = '!'
        if (this.option.is_link) {
            url = '' // []() 链接形式的图片也匹配
        }
        let regObj = {
            // 根据url和变量匹配url中要切割的部分
            sectionUrl: new RegExp(`(${replaceSlash(http)}${jointReg(this.option.var_number)}`, 'g'),
            // 根据url匹配整个图片url
            allUrl: new RegExp(`${url}\\[(.*)\\]\\(.*(${replaceSlash(this.option.replace_image_url)}.*?)\\)`, 'g'),
            imgDivUrl: new RegExp(`src=".*${replaceSlash(this.option.replace_image_url)}.*?"`, 'g'),
        }
        return regObj[type]
    }

    /**
     * @desc 获取对应图片链接的url
     * @param {*} type 图片展示类型 ![]() 或者是 <img src="xxx">
     */
    getMarkDownUrl = (type, link) => {
        let imageReg;
        let imageUrl;
         // 提取markdown图片语法 ![]
        if (type === 'allUrl') {
            imageReg = /\((.+?)\)/;
            imageUrl = imageReg.exec(link)[1];
        } else {
            imageReg = /src="(.+?)"/;
            imageUrl = imageReg.exec(link)[1];
            // console.log('div', imageUrl);
        }
        return imageUrl;
    }

    /**
     * 递归查找文件夹，找到markdown文件的图片语法，
     * 匹配要被替换的图片，添加图片到数组/替换图片地址
     * @param {Stying} path 查找的文件夹
     * @param {Bealoon} replace 是否替换查找
     * @return:
     * @Created_time: 2019-05-29 14:18:28
     */
    readFile(path) {
        if (!util.checkDataAction('String', path)) return
        var files = fs.readdirSync(path); // 返回文件数组
        files.forEach((item) => {
            let url = `${path}/${item}`; // 文件路径
            let isDirectory = fs.statSync(url).isDirectory(); // 判断是否为文件夹
            if (isDirectory) {
                // 递归文件夹
                if (!this.option.filter_item.includes(url)) {
                    return this.readFile(url)
                }
            } else {
                if (item.indexOf('.md') !== -1) {
                    // 读取文件
                    const imageList = [];
                    let data = fs.readFileSync(url, 'utf-8'); // 获取文件内容 返回字符串
                    ['allUrl', 'imgDivUrl'].map(type => {
                        let reg = this.reg(type);
                        const matchImageList = data.match(reg);
                        matchImageList && matchImageList.map(link => {
                            const imageUrl = this.getMarkDownUrl(type, link);
                            if (!imageList.includes(imageUrl) && !imageUrl.includes('http:') && !imageUrl.includes('https:')) {
                                imageList.push(imageUrl);
                                this.imageLegth++;
                                // 转化为二维数组进行记录
                            }
                        });
                    });
                    this.filePathList.push({
                        url,
                        data,
                        imageList,
                    });


                    // while ((res = reg.exec(data)) !== null) {
                    //     console.log('reg: ', reg);
                    //     let regUrl = res[2]
                    //     // 添加图片到数组 是否找到该字符串
                    //     if (regUrl.indexOf(this.option.replace_image_url) !== -1) {
                    //         if (replace) {
                    //             console.log('regUrl[0]', res[1], res[2]);
                    //             // 做的操作：
                    //             // http://ww1.sinaimg.cn/large/aaaaa.jpg，![](https://user-gold-cdn.xitu.io/2019/5/20/16ad3ff354f2dac3?w=2024&h=1240&f=png&s=339262)
                    //             // 变量0：[ '', 'http://ww1.sinaimg.cn/large/', 'aaaaa.jpg' ]
                    //             // 变量3(日期)：['![](', 'https://user-gold-cdn.xitu.io/2019/5/20/', '16ad3ff354f2dac3?w=2024&h=1240&f=png&s=339262)']
                    //             try {
                    //                 let sectionUrlReg = this.reg('sectionUrl')
                    //                 let splitArr = regUrl.split(sectionUrlReg)
                    //                 const fileName = this.fileNameFormat(splitArr[2])
                    //                 let replaceUrl = `${this.option.new_image_url}${fileName}`
                    //                 // 可以添加后缀 如github查看图片后缀为: ?raw=true
                    //                 if (this.option.add_end) {
                    //                     replaceUrl += this.option.add_end
                    //                 }
                    //                 // 替换字符串
                    //                 isChange = true
                    //                 data = data.replace(regUrl, replaceUrl)
                    //             } catch (err) {
                    //                 throw `请检查new_image_url、var_number的设置：${err}`
                    //             }
                    //         } else {
                    //             // 去重
                    //             if (!this.imgList.includes(regUrl)) {
                    //                 this.imgList.push(regUrl)
                    //             }
                    //         }
                    //     }
                    // }
                    // 修改文件
                    // if (replace && isChange) {
                    //     if (this.option.test) {
                    //         console.log('测试模式，不修改文件：', url)
                    //     } else {
                    //         fs.writeFile(url, data, 'utf-8', () => {
                    //             console.log('修改成功', url)
                    //         })
                    //     }
                    // }
                }
            }
        })
    }

    // 下载图片
    downImg() {
        // 创建文件夹
        this.mkdirSync();
        let num = 0
        async.mapSeries(this.imgList, (httpSrc, callback) => {
            // settimeout等待下载函数创建下载 不需要等下载完毕 是并行
            // 时间充裕的话可以下载函数放进函数中 在回调中调callback
            setTimeout(() => {
                // 图片名+后缀
                let sectionUrlReg = this.reg('sectionUrl')
                let splitArr = httpSrc.split(sectionUrlReg)
                try {
                    if (splitArr[2]) {
                        num++
                        const fileName = this.fileNameFormat(splitArr[2])
                        this.downloadPic(httpSrc, `${this.option.down_img_src}/${fileName}`)
                    }
                    callback(null, httpSrc);
                } catch (err) {
                    // 捕获报错 下载失败
                    callback(err, httpSrc);
                }
            }, 400);
        }, (err, res) => {
            if (err) {
                throw err;
            } else {
                console.log('图片下载完成：', res, num)
            }
        });
    }
    /**
     * @description: 处理图片名
     * @param {type}
     * @return: fileNAme
     * @Date: 2019-07-08 19:51:57
     */
    fileNameFormat(fileNAme) {
        if (this.option.downFileNameCallBack === null) {
            // 默认取图片名前部分的：字母或数字或下划线或汉字
            // 不匹配其他参数符号
            const reg = /^(\w+)/
            const res = fileNAme.match(reg)
            if (res && res[1]) {
                fileNAme = res[1]
            }
        } else {
            if (Object.prototype.toString.call(this.option.downFileNameCallBack) === '[object Function]') {
                fileNAme = this.option.downFileNameCallBack(fileNAme)
                if (typeof fileNAme !== 'string') {
                    throw '处理图片名错误:'
                }
            } else {
                throw '处理图片名错误:'
            }
        }
        return fileNAme
    }
    /**
     * 下载图片 命名冲突会覆盖旧的文件
     * @param {String} src 图片的下载地址
     * @param {String} imgPath 图片下载到哪里的地址
     * @Created_time: 2019-05-31 14:35:08
     */
    downloadPic(src, imgPath) {
        request(src).pipe(fs.createWriteStream(imgPath)).on('close', () => {
            console.log('pic saved!', src)
        })
    }
    /**
     * 创建文件夹 储存图片的地址
     * @param {type}
     * @return:
     * @Created_time: 2019-05-31 14:37:30
     */
    mkdirSync() {
        try {
            let isDirectory = fs.statSync(this.option.down_img_src).isDirectory(); // 判断是否为文件夹
            if (!isDirectory) {
                fs.mkdirSync(this.option.down_img_src, { recursive: true });
            }
        } catch (err) {
            fs.mkdirSync(this.option.down_img_src, { recursive: true });
        }
    }
    /*
     * 复制目录、子目录，及其中的文件
     * @param src {String} 要复制的目录
     * @param dist {String} 复制到目标目录
     */
    async copyDir(src, dist, callback) {
        var _copy = (err, src, dist) => {
            if (err) {
                callback(err);
            } else {
                try {
                    const paths = fs.readdirSync(src);
                    paths.forEach(async (path) => {
                        var _src = src + '/' + path;
                        var _dist = dist + '/' + path;
                        const stat = fs.statSync(_src);
                        // 判断是文件还是目录
                        if (stat.isFile() && !this.option.filter_item.includes(path)) {
                            const data = fs.readFileSync(_src);
                            fs.writeFileSync(_dist, data);
                            // console.log('拷贝', _dist)
                        } else if (stat.isDirectory()) {
                            // 当是目录是，递归复制
                            await this.copyDir(_src, _dist, callback)
                        }
                    });
                } catch (e) {
                    callback(e);
                }
            }
        }
        try {
            fs.access(dist);
            this.copyNow = false

        } catch (e) {
            // filename不为忽略文件
            const filename = path.basename(dist);
            if (this.option.filter_item.includes(filename)) {
                console.log('屏蔽盖文件');
                return;
            }
            // 目录不存在时创建目录
            try {
                fs.mkdirSync(dist, { recursive: true })
                _copy(null, src, dist);
            } catch (e) {
                callback(e);
            }
        }
    }
    /**
     * @param {Object} newOption
     * @return:
     * @Created_time: 2019-05-31 14:33:00
     */
    async updateOption(newOption = {}) {
        const limit = pLimit(1);

        const promiseList = [];
        if (!util.checkDataAction('Object', newOption, 'updateOption的参数为对象')) return
        this.option = Object.assign(this.option, newOption) // 配置参数
        console.log(`开始上传文件,文件数量为${this.filePathList.length} 图片数量为${this.imageLegth}`);
        this.filePathList.map(fileObj => {
            fileObj.imageList.map(async (imagePath) => {
                promiseList.push(limit(() => upLoadImage(this.option.upload_iamge_url, imagePath, fileObj.url)));
            });
        });
        const resultList = await Promise.all(promiseList);
        console.log('上传完成,一共为', resultList.length);
        resultList.map(result => {
            this.imgMap.set(result.imgPath, result.link);
        });
        console.log(`图片提取完成共：${this.imgMap.size}张`, this.imgMap)
    }

}


module.exports = markdownImageDown
