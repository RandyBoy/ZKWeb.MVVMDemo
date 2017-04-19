﻿import { Injectable } from '@angular/core';
import { Http, Response, Headers, RequestOptionsArgs } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/publishLast';
import { AppConfigService } from './app-config-service';

// 调用远程Api的服务
@Injectable()
export class AppApiService {
	// 全局Url过滤器
	private urlFilters: ((url: string) => string)[] = [];
	// 全局选项过滤器
	private optionsFilters: ((options: RequestOptionsArgs) => RequestOptionsArgs)[] = [];
	// 全局内容过滤器
	private bodyFilters: ((body: any) => any)[] = [];
	// 全局结果过滤器
	private resultFilters: ((response: Response) => Response)[] = [];
	// 全局错误过滤器
	private errorFilters: ((error: any) => any)[] = [];
	// 默认结果转换器
	private resultConverter: (response: Response) => any;
	// 默认错误转换器
	private errorConverter: (error: any) => Observable<any>;

	constructor(
		protected http: Http,
		protected appConfigService: AppConfigService) {
		// 让服务端把请求当作ajax请求
		this.registerOptionsFilter(options => {
			options.headers.append("X-Requested-With", "XMLHttpRequest");
			return options;
		});
		// 设置默认的结果转换器
		this.setResultConverter(response => {
			try {
				return response.json();
			} catch (e) {
				return response.text();
			}
		});
		// 设置默认的错误转换器
		this.setErrorConverter(error => {
			console.log("api request error:", error);
			var errorMessage: string;
			if (error instanceof Response) {
				errorMessage = error.text().replace(/<[^>]+>/g, ""); // 过滤html标签
			} else {
				errorMessage = JSON.stringify(error);
			}
			return new Observable(o => {
				o.error(errorMessage);
				o.complete();
			});
		});
	}

	// 注册全局Url过滤器
	registerUrlFilter(filter: (string) => string) {
		this.urlFilters.push(filter);
	}

	// 注册全局选项过滤器
	registerOptionsFilter(filter: (options: RequestOptionsArgs) => RequestOptionsArgs) {
		this.optionsFilters.push(filter);
	}

	// 注册全局内容过滤器
	registerBodyFilter(filter: (body: any) => any) {
		this.bodyFilters.push(filter);
	}

	// 注册全局结果过滤器
	registerResultFilter(filter: (response: Response) => Response) {
		this.resultFilters.push(filter);
	}

	// 注册全局错误过滤器
	registerErrorFilter(filter: (error: any) => any) {
		this.errorFilters.push(filter);
	}

	// 设置默认结果转换器
	setResultConverter(converter: (response: Response) => any) {
		this.resultConverter = converter;
	}

	// 获取默认结果转换器
	getResultConverter(): (response: Response) => any {
		return this.resultConverter;
	}

	// 设置默认错误转换器
	setErrorConverter(converter: (error: any) => any) {
		this.errorConverter = converter;
	}

	// 获取默认错误转换器
	getErrorConverter(): (error: any) => any {
		return this.errorConverter;
	}

	// 调用Api函数
	call<T>(
		url: string,
		body: any,
		options?: RequestOptionsArgs,
		resultConverter?: (Response) => any,
		errorConverter?: (any) => any): Observable<T> {
		// 构建完整url，可能不在同一个host
		var fullUrl = this.appConfigService.getApiUrlBase() + url;
		this.urlFilters.forEach(h => { fullUrl = h(fullUrl) });
		// 构建选项，包括http头等
		options = options || {};
		options.headers = options.headers || new Headers();
		this.optionsFilters.forEach(h => { options = h(options) });
		// 构建提交内容
		this.bodyFilters.forEach(h => { body = h(body) });
		return this.http
			.post(fullUrl, body, options) // 使用post提交api
			.publishLast().refCount() // 防止多次subscribe导致多次提交
			.map(response => {
				// 过滤返回的结果
				this.resultFilters.forEach(f => { response = f(response) });
				// 转换返回的结果
				return (resultConverter || this.resultConverter)(response);
			})
			.catch(error => {
				// 过滤返回的错误
				this.errorFilters.forEach(f => { error = f(error) });
				// 转换返回的错误
				return (errorConverter || this.errorConverter)(error);
			});
	}
}
