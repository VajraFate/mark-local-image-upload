const fs = require('fs'); // 文件模块
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { resolve } = require('path');
const config = require('../config/config');

const formHeaders = {
  // 'Content-Type': 'multipart/form-data',
  'X-Requested-With': 'XMLHttpRequest',
  'X-Auth-Token': config.token,
};
async function upLoadImage (upLoadUrl, imgPath, fileUrl) {
    // fileUrl = 'outputDir/03.亚马逊云（AWS）使用指南/3.4.负载均衡/4.传统负载均衡器.md';
    // imgPath = '../../images/aws_loadbalancer/1584083963673.png';
    const pathName = path.resolve(path.dirname(fileUrl), imgPath);
    try {
      const data = fs.readFileSync(pathName);
      const filename = path.basename(pathName);
      const extname = path.extname(pathName);
      const fd = new FormData();
      fd.append('upload_file', data, {
        contentType: `image/${extname}`,
        filename,
      });
      const headers = { ...formHeaders, ...fd.getHeaders() };
      // const link = imgPath;
      await new Promise(resolve => setTimeout(resolve, 1000));
      const link = await axios.post(`${upLoadUrl}`, fd, { headers }).then(res => {
        return res.data.name;
      });
      console.log('图片上传成功: ', new Date(), `${imgPath}  =>  ${link}`);
      return { link, imgPath };
    } catch (e) {
      console.log(e);
      console.log(`图片上传错误:  ${imgPath}`);
      return { link: '', imgPath };
    }
}
module.exports = upLoadImage;