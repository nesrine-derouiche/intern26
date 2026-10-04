import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../core/network/api_exception.dart';
import '../models/login_request.dart';
import '../models/login_response.dart';
import '../models/user.dart';

class AuthService {
  AuthService(this._dio);

  final Dio _dio;

  Future<LoginResponse> login(LoginRequest request) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        ApiConstants.login,
        data: request.toJson(),
      );
      return LoginResponse.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<User> getMe() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(ApiConstants.me);
      final data = (response.data ?? const {})['user'];
      return User.fromJson((data as Map<String, dynamic>?) ?? const {});
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> forgotPassword(String email) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        ApiConstants.forgotPassword,
        data: {'email': email},
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> resetPassword(String token, String password) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        ApiConstants.resetPassword,
        data: {'token': token, 'password': password},
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<User> updateProfile({
    String? nom,
    String? prenom,
    String? telephone,
    String? adresse,
  }) async {
    try {
      final data = <String, dynamic>{};
      if (nom != null) data['nom'] = nom;
      if (prenom != null) data['prenom'] = prenom;
      if (telephone != null) data['telephone'] = telephone;
      if (adresse != null) data['adresse'] = adresse;

      final response = await _dio.put<Map<String, dynamic>>(
        ApiConstants.updateProfile,
        data: data,
      );
      final userJson = (response.data ?? const {})['user'];
      return User.fromJson((userJson as Map<String, dynamic>?) ?? const {});
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      await _dio.put<Map<String, dynamic>>(
        ApiConstants.changePassword,
        data: {
          'current_password': currentPassword,
          'new_password': newPassword,
          'confirm_password': newPassword,
        },
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
