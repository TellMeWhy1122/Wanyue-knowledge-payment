<?php

// +----------------------------------------------------------------------
// |万岳科技开源系统 [山东万岳信息科技有限公司]
// +----------------------------------------------------------------------
// | Copyright (c) 2020~2022 https://www.sdwanyue.com All rights reserved.
// +----------------------------------------------------------------------
// | 万岳科技相关开源系统代码并不是自由软件，未经授权许可不能去掉wanyue【万岳科技】相关版权并商用
// +----------------------------------------------------------------------
// | Author: 万岳科技开源官方 < wanyuekj2020@163.com >
// +----------------------------------------------------------------------

namespace Qiniu\Storage;

use Qiniu\Auth;
use Qiniu\Config;
use Qiniu\Zone;
use Qiniu\Http\Client;
use Qiniu\Http\Error;

/**
 * 主要涉及了鉴黄接口的实现，具体的接口规格可以参考
 *
 * @link https://developer.qiniu.com/dora/manual/3674/kodo-product-introduction
 */
final class ArgusManager
{
    private $auth;
    private $config;

    public function __construct(Auth $auth, Config $config = null)
    {
        $this->auth = $auth;
        if ($config == null) {
            $this->config = new Config();
        } else {
            $this->config = $config;
        }
    }

    /**
     * 视频鉴黄
     *
     * @param $body     body信息
     * @param $vid      videoID
     *
     * @return mixed      成功返回NULL，失败返回对象Qiniu\Http\Error
     * @link  https://developer.qiniu.com/dora/manual/4258/video-pulp
     */
    public function pulpVideo($body, $vid)
    {
        $path = '/v1/video/' . $vid;
        
        return $this->arPost($path, $body);
    }

    private function getArHost()
    {
        $scheme = "http://";
        if ($this->config->useHTTPS == true) {
            $scheme = "https://";
        }
        return $scheme . Config::ARGUS_HOST;
    }

    private function arPost($path, $body = null)
    {
        $url = $this->getArHost() . $path;
        return $this->post($url, $body);
    }

    private function post($url, $body)
    {
        $headers = $this->auth->authorizationV2($url, 'POST', $body, 'application/json');
        $headers['Content-Type']='application/json';
        $ret = Client::post($url, $body, $headers);
        if (!$ret->ok()) {
            print($ret->statusCode);
            return array(null, new Error($url, $ret));
        }
        $r = ($ret->body === null) ? array() : $ret->json();
        return array($r, null);
    }
}
