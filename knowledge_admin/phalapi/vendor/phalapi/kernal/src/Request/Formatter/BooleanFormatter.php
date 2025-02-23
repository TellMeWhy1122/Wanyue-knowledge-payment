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

namespace PhalApi\Request\Formatter;

use PhalApi\Request\Formatter;
use PhalApi\Request\Formatter\BaseFormatter;

/**
 * BooleanFormatter 格式化布尔值
 *
 * @package     PhalApi\Request
 * @license     http://www.phalapi.net/license GPL 协议
 * @link        http://www.phalapi.net/
 * @author      dogstar <chanzonghuang@gmail.com> 2015-11-07
 */


class BooleanFormatter extends BaseFormatter implements Formatter {

    /**
     * 对布尔型进行格式化
     *
     * @param mixed $value 变量值
     * @param array $rule array('TRUE' => '成立时替换的内容', 'FALSE' => '失败时替换的内容')
     * @return boolean/string 格式化后的变量
     *
     */
    public function parse($value, $rule) {
        $rs = $value;

        if (!is_bool($value)) {
            if (is_numeric($value)) {
                $rs = $value > 0 ? TRUE : FALSE;
            } else if (is_string($value)) {
                $rs = in_array(strtolower($value), array('ok', 'true', 'success', 'on', 'yes')) 
                    ? TRUE : FALSE;
            } else {
                $rs = $value ? TRUE : FALSE;
            }
        }

        return $rs;
    }
}
